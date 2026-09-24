mod commands;
mod scanner;
pub mod search;
mod types;

use commands::AppState;
use search::commands::SearchEngine;
use std::sync::Arc;
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
            app.manage(engine);

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
