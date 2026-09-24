use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::ipc::Channel;
use tauri::State;

use crate::search::indexer::{run_indexing, IndexEvent, IndexManager, IndexStatus};
use crate::search::query::{execute_search, SearchParams, SearchResult};
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

        Self {
            app_data_dir,
            manager: Arc::new(std::sync::Mutex::new(manager)),
            settings: Arc::new(std::sync::Mutex::new(settings)),
            is_indexing: Arc::new(AtomicBool::new(false)),
            is_paused: Arc::new(AtomicBool::new(false)),
            cancel_token: Arc::new(AtomicBool::new(false)),
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
pub fn get_index_status(engine: State<'_, Arc<SearchEngine>>) -> Result<IndexStatus, String> {
    let is_indexing = engine.is_indexing.load(Ordering::SeqCst);
    let is_paused = engine.is_paused.load(Ordering::SeqCst);
    let manager_guard = engine.manager.lock().unwrap();

    if let Some(ref manager) = *manager_guard {
        Ok(manager.get_status(is_indexing, is_paused))
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

        let result = {
            let manager_guard = engine_clone.manager.lock().unwrap();
            if let Some(ref manager) = *manager_guard {
                run_indexing(
                    manager,
                    &settings,
                    rebuild_flag,
                    &on_event,
                    Arc::clone(&engine_clone.cancel_token),
                    Arc::clone(&engine_clone.is_paused),
                )
            } else {
                Err("Index manager is not initialized.".to_string())
            }
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
    engine.cancel_token.store(true, Ordering::SeqCst);
    engine.is_paused.store(false, Ordering::SeqCst);
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
        let mut manager_guard = manager_arc.lock().unwrap();
        // Drop current manager so locks are released
        *manager_guard = None;

        let index_dir = app_data_dir.join("index");
        if index_dir.exists() {
            let _ = std::fs::remove_dir_all(&index_dir);
        }

        // Recreate clean manager
        match IndexManager::open_or_create(&app_data_dir) {
            Ok(new_manager) => {
                *manager_guard = Some(new_manager);
                Ok(())
            }
            Err(e) => Err(format!("Failed to recreate index: {}", e)),
        }
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
    let (content_extensions, max_content_size_mb) = {
        let s = engine.settings.lock().unwrap();
        (s.content_extensions.clone(), s.max_content_size_mb)
    };

    let manager_guard = engine.manager.lock().unwrap();
    let manager = manager_guard
        .as_ref()
        .ok_or_else(|| "Index is not available.".to_string())?;

    let searcher = manager.reader.searcher();
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

    execute_search(
        &manager.index,
        &searcher,
        &manager.fields,
        params,
        &content_extensions,
        max_content_size_mb,
    )
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
            tauri_plugin_opener::open_path(&path, None::<&str>)
                .map_err(|e| format!("Failed to open path: {}", e))
        }
    })
    .await
    .map_err(|e| format!("Task execution error: {}", e))?
}
