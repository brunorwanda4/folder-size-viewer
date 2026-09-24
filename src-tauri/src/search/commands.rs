use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tauri::ipc::Channel;
use tauri::State;

use crate::search::indexer::{run_indexing, IndexEvent, IndexManager, IndexStatus};
use crate::search::query::{
    execute_search, live_filesystem_search, stream_live_filesystem_search, SearchHit, SearchParams,
    SearchResult, SearchStreamEvent,
};
use crate::search::settings::SearchSettings;

pub struct SearchEngine {
    pub app_data_dir: PathBuf,
    pub manager: Arc<std::sync::Mutex<Option<IndexManager>>>,
    pub settings: Arc<std::sync::Mutex<SearchSettings>>,
    pub is_indexing: Arc<AtomicBool>,
    pub is_paused: Arc<AtomicBool>,
    pub cancel_token: Arc<AtomicBool>,
    pub active_search_token: Arc<AtomicU64>,
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
            active_search_token: Arc::new(AtomicU64::new(0)),
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
    if engine.is_indexing.load(Ordering::SeqCst) {
        return Err("Indexing is already running.".to_string());
    }

    let rebuild = rebuild.unwrap_or(false);
    let app_data_dir = engine.app_data_dir.clone();
    let manager_arc = Arc::clone(&engine.manager);

    if rebuild {
        let new_manager = tokio::task::spawn_blocking(move || {
            let index_dir = app_data_dir.join("index");
            if index_dir.exists() {
                let _ = std::fs::remove_dir_all(&index_dir);
            }
            IndexManager::open_or_create(&app_data_dir)
        })
        .await
        .map_err(|e| format!("Rebuild task error: {}", e))?
        .map_err(|e| format!("Failed to create new index: {}", e))?;

        let mut guard = manager_arc.lock().unwrap();
        *guard = Some(new_manager);
    }

    let manager = {
        let guard = engine.manager.lock().unwrap();
        guard.clone()
    }
    .ok_or_else(|| "Index manager not available.".to_string())?;

    let settings = {
        let guard = engine.settings.lock().unwrap();
        guard.clone()
    };

    engine.is_indexing.store(true, Ordering::SeqCst);
    engine.cancel_token.store(false, Ordering::SeqCst);
    engine.is_paused.store(false, Ordering::SeqCst);

    let is_indexing = Arc::clone(&engine.is_indexing);
    let is_paused = Arc::clone(&engine.is_paused);
    let cancel_token = Arc::clone(&engine.cancel_token);

    std::thread::Builder::new()
        .name("search-indexing-worker".into())
        .spawn(move || {
            let _ = run_indexing(
                &manager,
                &settings,
                rebuild,
                &on_event,
                cancel_token,
                Arc::clone(&is_paused),
            );
            is_indexing.store(false, Ordering::SeqCst);
            is_paused.store(false, Ordering::SeqCst);
        })
        .map_err(|e| format!("Failed to spawn indexing thread: {}", e))?;

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
    extensions: Option<Vec<String>>,
    modified_from: Option<u64>,
    modified_to: Option<u64>,
    sort_by: Option<String>,
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
            extensions,
            modified_from,
            modified_to,
            sort_by,
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
            let mut existing_paths = std::collections::HashSet::new();
            let limit_val = params.limit.unwrap_or(50);
            let hits = live_filesystem_search(
                &params,
                &roots,
                &exclusions,
                &mut existing_paths,
                limit_val,
                std::time::Duration::from_millis(3000),
            );
            Ok(SearchResult {
                hits: hits.clone(),
                total: hits.len(),
                took_ms: 0,
            })
        }
    })
    .await
    .map_err(|e| format!("Search task execution failed: {}", e))?
}

#[tauri::command]
pub async fn stream_search(
    query: String,
    scope: String,
    current_path: Option<String>,
    mode: String,
    filter_type: Option<String>,
    filter_category: Option<String>,
    extensions: Option<Vec<String>>,
    modified_from: Option<u64>,
    modified_to: Option<u64>,
    sort_by: Option<String>,
    on_event: Channel<SearchStreamEvent>,
    engine: State<'_, Arc<SearchEngine>>,
) -> Result<(), String> {
    let start_time = Instant::now();
    let search_token = engine.active_search_token.fetch_add(1, Ordering::SeqCst) + 1;

    let clean_query = query.trim().to_string();
    if clean_query.is_empty() {
        let _ = on_event.send(SearchStreamEvent::Done {
            total: 0,
            took_ms: 0,
        });
        return Ok(());
    }

    let (content_extensions, max_content_size_mb, roots, exclusions, batch_size) = {
        let s = engine.settings.lock().unwrap();
        let r: Vec<String> = s.roots.iter().map(|item| item.path.clone()).collect();
        (
            s.content_extensions.clone(),
            s.max_content_size_mb,
            r,
            s.exclusions.clone(),
            s.search_batch_size.clamp(10, 500),
        )
    };

    let manager = {
        let manager_guard = engine.manager.lock().unwrap();
        manager_guard.as_ref().cloned()
    };

    let active_token = Arc::clone(&engine.active_search_token);

    tokio::task::spawn_blocking(move || {
        let mut existing_paths: std::collections::HashSet<String> =
            std::collections::HashSet::new();
        let mut initial_hits = Vec::new();
        let mut total_found = 0;

        let params = SearchParams {
            query: clean_query.clone(),
            scope,
            current_path,
            mode,
            filter_type,
            filter_category,
            extensions,
            modified_from,
            modified_to,
            sort_by,
            limit: Some(batch_size),
            offset: Some(0),
        };

        // 1. Direct path check
        let q_unquoted = clean_query.trim_matches(['"', '\'', '`']);
        let direct_path = PathBuf::from(q_unquoted);
        if direct_path.exists() {
            let path_str = direct_path.to_string_lossy().to_string();
            #[cfg(windows)]
            let key = path_str.to_lowercase();
            #[cfg(not(windows))]
            let key = path_str.clone();

            existing_paths.insert(key);
            let is_dir = direct_path.is_dir();
            let name = direct_path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| path_str.clone());
            let ext = direct_path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_string();
            let category = if is_dir {
                "Folder".to_string()
            } else {
                crate::types::classify(&ext).as_str().to_string()
            };
            let meta = direct_path.metadata().ok();
            let size_bytes = if is_dir {
                0
            } else {
                meta.as_ref().map(|m| m.len()).unwrap_or(0)
            };
            let modified = meta
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64);

            let mut include = true;
            if let Some(ref exts) = params.extensions {
                let valid: Vec<String> = exts.iter().map(|e| e.trim().trim_start_matches('.').to_lowercase()).filter(|e| !e.is_empty()).collect();
                if !valid.is_empty() && !is_dir && !valid.contains(&ext.to_lowercase()) {
                    include = false;
                }
            }
            if let Some(from_ms) = params.modified_from {
                if let Some(m) = modified {
                    if m < from_ms { include = false; }
                } else { include = false; }
            }
            if let Some(to_ms) = params.modified_to {
                if let Some(m) = modified {
                    if m > to_ms { include = false; }
                } else { include = false; }
            }
            if include {
                initial_hits.push(SearchHit {
                    name,
                    path: path_str,
                    is_dir,
                    size_bytes,
                    modified,
                    category,
                    snippet: None,
                    matched_name_ranges: Vec::new(),
                });
                total_found += 1;
            }
        }

        // 2. Tantivy index search
        if let Some(ref m) = manager {
            let searcher = m.reader.searcher();
            if let Ok(res) = execute_search(
                &m.index,
                &searcher,
                &m.fields,
                params.clone(),
                &roots,
                &exclusions,
                &content_extensions,
                max_content_size_mb,
            ) {
                for hit in res.hits {
                    #[cfg(windows)]
                    let key = hit.path.to_lowercase();
                    #[cfg(not(windows))]
                    let key = hit.path.clone();

                    if !existing_paths.contains(&key) {
                        existing_paths.insert(key);
                        initial_hits.push(hit);
                        total_found += 1;
                    }
                }
            }
        }

        if let Some(ref sort_order) = params.sort_by {
            crate::search::query::sort_hits(&mut initial_hits, sort_order);
        }

        // Emit first batch immediately if we found hits from direct match or Tantivy
        if !initial_hits.is_empty() {
            let _ = on_event.send(SearchStreamEvent::Batch {
                hits: initial_hits,
                total: total_found,
                took_ms: start_time.elapsed().as_millis() as u64,
            });
        }

        if active_token.load(Ordering::Relaxed) != search_token {
            return;
        }

        // 3. Stream live filesystem search for remaining results
        stream_live_filesystem_search(
            params,
            roots,
            exclusions,
            existing_paths,
            batch_size,
            on_event,
            active_token,
            search_token,
            total_found,
            start_time,
        );
    });

    Ok(())
}

#[tauri::command]
pub fn cancel_search(engine: State<'_, Arc<SearchEngine>>) -> Result<(), String> {
    engine.active_search_token.fetch_add(1, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub async fn open_path(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open path: {}", e))?;
        Ok(())
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open path: {}", e))?;
        Ok(())
    }
    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open path: {}", e))?;
        Ok(())
    }
}
