mod commands;
mod scanner;
pub mod search;
mod types;

use commands::AppState;
use search::commands::SearchEngine;
use search::indexer::SCHEMA_META_FILENAME;
use std::sync::Arc;
use std::time::Duration;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .manage(AppState::default())
        .setup(|app| {
            let app_handle = app.handle();
            let app_data_dir = app_handle
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");

            let engine = Arc::new(SearchEngine::new(app_data_dir));
            app.manage(engine.clone());

            // Auto-run an incremental update in the background if an index already exists
            let meta_file = engine.app_data_dir.join("index").join(SCHEMA_META_FILENAME);
            if meta_file.is_file() {
                let engine_clone = Arc::clone(&engine);
                std::thread::Builder::new()
                    .name("search-auto-indexer".into())
                    .spawn(move || {
                        // Small delay to let the app initialize and display the UI first
                        std::thread::sleep(Duration::from_millis(1500));

                        if engine_clone
                            .is_indexing
                            .swap(true, std::sync::atomic::Ordering::SeqCst)
                        {
                            return;
                        }
                        engine_clone
                            .is_paused
                            .store(false, std::sync::atomic::Ordering::SeqCst);
                        engine_clone
                            .cancel_token
                            .store(false, std::sync::atomic::Ordering::SeqCst);

                        let settings = {
                            let s = engine_clone.settings.lock().unwrap();
                            s.clone()
                        };
                        let manager_guard = engine_clone.manager.lock().unwrap();
                        if let Some(ref manager) = *manager_guard {
                            let dummy_channel = tauri::ipc::Channel::new(|_| Ok(()));
                            let _ = search::indexer::run_indexing(
                                manager,
                                &settings,
                                false, // incremental update
                                &dummy_channel,
                                Arc::clone(&engine_clone.cancel_token),
                                Arc::clone(&engine_clone.is_paused),
                            );
                        }
                        engine_clone
                            .is_indexing
                            .store(false, std::sync::atomic::Ordering::SeqCst);
                        engine_clone
                            .is_paused
                            .store(false, std::sync::atomic::Ordering::SeqCst);
                    })
                    .ok();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::scan_dir,
            commands::cancel_scan,
            commands::reveal_in_explorer,
            commands::get_default_paths,
            commands::delete_item,
            search::commands::get_search_settings,
            search::commands::save_search_settings,
            search::commands::get_index_status,
            search::commands::start_indexing,
            search::commands::pause_indexing,
            search::commands::resume_indexing,
            search::commands::cancel_indexing,
            search::commands::clear_index,
            search::commands::search,
            search::commands::open_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running folder size viewer application");
}
