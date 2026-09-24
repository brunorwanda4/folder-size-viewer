use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::ipc::Channel;
use tauri::State;

use crate::scanner;
use crate::types::{DefaultPaths, ScanEvent, ScanResult};

pub struct AppState {
    pub cancel_token: Arc<AtomicBool>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            cancel_token: Arc::new(AtomicBool::new(false)),
        }
    }
}

#[tauri::command]
pub async fn scan_dir(
    path: String,
    on_event: Channel<ScanEvent>,
    state: State<'_, AppState>,
) -> Result<ScanResult, String> {
    let cancel_token = state.cancel_token.clone();

    // Spawn blocking task on Rayon/tokio threadpool so the async runtime & UI are never blocked
    tokio::task::spawn_blocking(move || scanner::scan_directory(&path, on_event, cancel_token))
        .await
        .map_err(|e| format!("Task execution error: {}", e))?
}

#[tauri::command]
pub fn cancel_scan(state: State<'_, AppState>) -> Result<(), String> {
    state.cancel_token.store(true, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub async fn reveal_in_explorer(path: String, is_dir: Option<bool>) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let is_dir = is_dir.unwrap_or_else(|| std::path::Path::new(&path).is_dir());

        #[cfg(windows)]
        {
            use std::process::Command;
            let clean_path = path.replace('/', "\\");
            let mut cmd = Command::new("explorer");
            if is_dir {
                // Open into the folder directly
                cmd.arg(&clean_path);
            } else {
                // For files, open parent directory and select the file
                cmd.args(["/select,", &clean_path]);
            }
            cmd.spawn()
                .map_err(|e| format!("Failed to launch explorer: {}", e))?;
            Ok(())
        }

        #[cfg(not(windows))]
        {
            if is_dir {
                tauri_plugin_opener::open_path(&path, None::<&str>)
                    .map_err(|e| format!("Failed to open folder: {}", e))
            } else {
                tauri_plugin_opener::reveal_item_in_dir(&path)
                    .map_err(|e| format!("Failed to reveal item in folder: {}", e))
            }
        }
    })
    .await
    .map_err(|e| format!("Task execution error: {}", e))?
}

#[tauri::command]
pub fn get_default_paths() -> DefaultPaths {
    DefaultPaths {
        local_app_data: std::env::var("LOCALAPPDATA")
            .ok()
            .or_else(|| dirs::data_local_dir().map(|p| p.to_string_lossy().to_string())),
        app_data: std::env::var("APPDATA")
            .ok()
            .or_else(|| dirs::config_dir().map(|p| p.to_string_lossy().to_string())),
        temp: Some(std::env::temp_dir().to_string_lossy().to_string()),
        home: dirs::home_dir().map(|p| p.to_string_lossy().to_string()),
        downloads: dirs::download_dir().map(|p| p.to_string_lossy().to_string()),
    }
}

#[tauri::command]
pub async fn delete_item(path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let p = std::path::Path::new(&path);
        if !p.exists() {
            return Err("Target path does not exist or has already been deleted.".to_string());
        }

        fn make_writable(path: &std::path::Path) {
            if let Ok(metadata) = std::fs::metadata(path) {
                let mut perms = metadata.permissions();
                if perms.readonly() {
                    perms.set_readonly(false);
                    let _ = std::fs::set_permissions(path, perms);
                }
            }
        }

        fn remove_dir_all_recursive(dir: &std::path::Path) -> std::io::Result<()> {
            if let Ok(entries) = std::fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let entry_path = entry.path();
                    if entry_path.is_dir() {
                        let _ = remove_dir_all_recursive(&entry_path);
                    } else {
                        make_writable(&entry_path);
                        let _ = std::fs::remove_file(&entry_path);
                    }
                }
            }
            make_writable(dir);
            std::fs::remove_dir_all(dir)
        }

        if p.is_dir() {
            remove_dir_all_recursive(p).map_err(|e| format!("Failed to delete folder: {}", e))
        } else {
            make_writable(p);
            std::fs::remove_file(p).map_err(|e| format!("Failed to delete file: {}", e))
        }
    })
    .await
    .map_err(|e| format!("Task execution error: {}", e))?
}
