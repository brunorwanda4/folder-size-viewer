use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tauri::ipc::Channel;
use tauri::State;

use crate::search::indexer::{run_indexing, IndexEvent, IndexManager, IndexStatus};
use crate::search::query::{execute_search, live_filesystem_search, SearchParams, SearchResult};
use crate::search::settings::SearchSettings;

pub struct SearchEngine {
    pub app_data_dir: PathBuf,
    pub manager: Arc<std::sync::Mutex<Option<IndexManager>>>,
    pub settings: Arc<std::sync::Mutex<SearchSettings>>,
    pub is_indexing: Arc<AtomicBool>,
    pub is_paused: Arc<AtomicBool>,
    pub cancel_token: Arc<AtomicBool>,
}

impl SearchEngine {
    pub fn new(app_data_dir: PathBuf) -> Self {
        let settings = SearchSettings::load_or_default(&app_data_dir);
        let manager = match IndexManager::open_or_create(&app_data_dir) {
            Ok(m) => Some(m),
            Err(e) => {
                eprintln!("Failed to open index manager: {}", e);
                None
            }
        };

        let engine = Self {
            app_data_dir,
            manager: Arc::new(std::sync::Mutex::new(manager)),
            settings: Arc::new(std::sync::Mutex::new(settings)),
            is_indexing: Arc::new(AtomicBool::new(false)),
            is_paused: Arc::new(AtomicBool::new(false)),
            cancel_token: Arc::new(AtomicBool::new(false)),
        };

        // Automatically manage index in the background: if index is empty, build it automatically
        engine.auto_index_if_empty();

        engine
    }

    pub fn auto_index_if_empty(&self) {
        let is_empty = {
            let guard = self.manager.lock().unwrap();
            if let Some(ref m) = *guard {
                m.get_status(false, false).doc_count == 0
            } else {
                false
            }
        };

        if is_empty && !self.is_indexing.load(Ordering::SeqCst) {
            self.is_indexing.store(true, Ordering::SeqCst);
            self.cancel_token.store(false, Ordering::SeqCst);
            self.is_paused.store(false, Ordering::SeqCst);

            let is_indexing = Arc::clone(&self.is_indexing);
            let is_paused = Arc::clone(&self.is_paused);
            let cancel_token = Arc::clone(&self.cancel_token);
            let manager_arc = Arc::clone(&self.manager);
            let settings_arc = Arc::clone(&self.settings);

            std::thread::Builder::new()
                .name("auto-indexing-worker".into())
                .spawn(move || {
                    let settings = {
                        let s = settings_arc.lock().unwrap();
                        s.clone()
                    };
                    let manager_opt = {
                        let guard = manager_arc.lock().unwrap();
                        guard.clone()
                    };

                    if let Some(manager) = manager_opt {
                        let channel = Channel::new(|_| Ok(()));
                        let _ = run_indexing(
                            &manager,
                            &settings,
                            false,
                            &channel,
                            cancel_token,
                            Arc::clone(&is_paused),
                        );
                    }

                    is_indexing.store(false, Ordering::SeqCst);
                    is_paused.store(false, Ordering::SeqCst);
                })
                .ok();
        }
    }
}

#[tauri::command]
pub fn get_search_settings(engine: State<'_, Arc<SearchEngine>>) -> SearchSettings {
    let settings = engine.settings.lock().unwrap();
    settings.clone()
}

#[tauri::command]
pub fn save_search_settings(
    settings: SearchSettings,
    engine: State<'_, Arc<SearchEngine>>,
) -> Result<(), String> {
    settings.save(&engine.app_data_dir)?;
    let mut current = engine.settings.lock().unwrap();
    *current = settings;
    Ok(())
}

#[tauri::command]
pub async fn get_index_status(engine: State<'_, Arc<SearchEngine>>) -> Result<IndexStatus, String> {
    let is_indexing = engine.is_indexing.load(Ordering::SeqCst);
    let is_paused = engine.is_paused.load(Ordering::SeqCst);
    let manager = {
        let guard = engine.manager.lock().unwrap();
        guard.clone()
    };

    if let Some(manager) = manager {
        tokio::task::spawn_blocking(move || Ok(manager.get_status(is_indexing, is_paused)))
            .await
            .map_err(|e| format!("Task execution error: {}", e))?
    } else {
        Ok(IndexStatus {
            doc_count: 0,
            size_bytes: 0,
            last_updated: None,
            is_indexing,
            is_paused,
        })
    }
}

#[tauri::command]
pub async fn start_indexing(
    rebuild: Option<bool>,
    on_event: Channel<IndexEvent>,
    engine: State<'_, Arc<SearchEngine>>,
) -> Result<(), String> {
    if engine.is_indexing.swap(true, Ordering::SeqCst) {
        return Err("Indexing is already running.".to_string());
    }

    engine.is_paused.store(false, Ordering::SeqCst);
    engine.cancel_token.store(false, Ordering::SeqCst);

    let engine_clone = Arc::clone(&engine);
    let rebuild_flag = rebuild.unwrap_or(false);

    tokio::task::spawn_blocking(move || {
        let settings = {
            let s = engine_clone.settings.lock().unwrap();
            s.clone()
        };

        // Clone IndexManager handle and release the lock immediately so other operations
        // (status queries, searches) are never blocked during indexing!
        let manager_opt = {
            let manager_guard = engine_clone.manager.lock().unwrap();
            manager_guard.clone()
        };

        let result = if let Some(manager) = manager_opt {
            run_indexing(
                &manager,
                &settings,
                rebuild_flag,
                &on_event,
                Arc::clone(&engine_clone.cancel_token),
                Arc::clone(&engine_clone.is_paused),
            )
        } else {
            Err("Index manager is not initialized.".to_string())
        };

        if let Err(e) = result {
            let _ = on_event.send(IndexEvent::Error {
                message: e.to_string(),
            });
        }

        engine_clone.is_indexing.store(false, Ordering::SeqCst);
        engine_clone.is_paused.store(false, Ordering::SeqCst);
    })
    .await
    .map_err(|e| format!("Task execution error: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn pause_indexing(engine: State<'_, Arc<SearchEngine>>) -> Result<(), String> {
    if engine.is_indexing.load(Ordering::SeqCst) {
        engine.is_paused.store(true, Ordering::SeqCst);
    }
    Ok(())
}

#[tauri::command]
pub fn resume_indexing(engine: State<'_, Arc<SearchEngine>>) -> Result<(), String> {
    if engine.is_indexing.load(Ordering::SeqCst) {
        engine.is_paused.store(false, Ordering::SeqCst);
    }
    Ok(())
}

#[tauri::command]
pub fn cancel_indexing(engine: State<'_, Arc<SearchEngine>>) -> Result<(), String> {
    if engine.is_indexing.load(Ordering::SeqCst) {
        engine.cancel_token.store(true, Ordering::SeqCst);
    }
    Ok(())
}

#[tauri::command]
pub async fn clear_index(engine: State<'_, Arc<SearchEngine>>) -> Result<(), String> {
    if engine.is_indexing.load(Ordering::SeqCst) {
        return Err("Cannot clear index while indexing is in progress.".to_string());
    }

    let app_data_dir = engine.app_data_dir.clone();
    let manager_arc = Arc::clone(&engine.manager);

    tokio::task::spawn_blocking(move || {
        let index_dir = app_data_dir.join("index");
        if index_dir.exists() {
            let _ = std::fs::remove_dir_all(&index_dir);
        }

        let new_manager = IndexManager::open_or_create(&app_data_dir)
            .map_err(|e| format!("Failed to recreate index: {}", e))?;

        let mut guard = manager_arc.lock().unwrap();
        *guard = Some(new_manager);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

#[tauri::command]
pub async fn search(
    query: String,
    scope: String,
    current_path: Option<String>,
    mode: String,
    filter_type: Option<String>,
    filter_category: Option<String>,
    limit: Option<usize>,
    offset: Option<usize>,
    engine: State<'_, Arc<SearchEngine>>,
) -> Result<SearchResult, String> {
    let (content_extensions, max_content_size_mb, roots, exclusions) = {
        let s = engine.settings.lock().unwrap();
        let roots: Vec<String> = s.roots.iter().map(|r| r.path.clone()).collect();
        (
            s.content_extensions.clone(),
            s.max_content_size_mb,
            roots,
            s.exclusions.clone(),
        )
    };

    let manager = {
        let manager_guard = engine.manager.lock().unwrap();
        manager_guard.as_ref().cloned()
    };

    tokio::task::spawn_blocking(move || {
        let params = SearchParams {
            query,
            scope,
            current_path,
            mode,
            filter_type,
            filter_category,
            limit,
            offset,
        };

        if let Some(ref m) = manager {
            let searcher = m.reader.searcher();
            execute_search(
                &m.index,
                &searcher,
                &m.fields,
                params,
                &roots,
                &exclusions,
                &content_extensions,
                max_content_size_mb,
            )
        } else {
            let start = Instant::now();
            let limit_num = params.limit.unwrap_or(50).max(1);
            let mut existing = std::collections::HashSet::new();
            let hits = live_filesystem_search(
                &params,
                &roots,
                &exclusions,
                &mut existing,
                limit_num,
                std::time::Duration::from_millis(2000),
            );
            let total = hits.len();
            Ok(SearchResult {
                hits,
                total,
                took_ms: start.elapsed().as_millis() as u64,
            })
        }
    })
    .await
    .map_err(|e| format!("Search task error: {}", e))?
}

#[tauri::command]
pub async fn open_path(path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        #[cfg(windows)]
        {
            use std::process::Command;
            let clean = path.replace('/', "\\");
            Command::new("cmd")
                .args(["/c", "start", "", &clean])
                .spawn()
                .map_err(|e| format!("Failed to open path: {}", e))?;
            Ok(())
        }
        #[cfg(not(windows))]
        {
            use std::process::Command;
            Command::new("xdg-open")
                .arg(&path)
                .spawn()
                .map_err(|e| format!("Failed to open path: {}", e))?;
            Ok(())
        }
    })
    .await
    .map_err(|e| format!("Task execution error: {}", e))?
}
