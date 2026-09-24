mod commands;
mod scanner;
mod types;

use commands::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::scan_dir,
            commands::cancel_scan,
            commands::reveal_in_explorer,
            commands::get_default_paths,
            commands::delete_item,
        ])
        .run(tauri::generate_context!())
        .expect("error while running folder size viewer application");
}
