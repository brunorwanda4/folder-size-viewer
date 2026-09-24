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
pub async fn reveal_in_explorer(path: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::process::Command;
        let clean_path = path.replace('/', "\\");
        Command::new("explorer")
            .args(["/select,", &clean_path])
            .spawn()
            .map_err(|e| format!("Failed to launch explorer: {}", e))?;
        Ok(())
    }

    #[cfg(not(windows))]
    {
        tauri_plugin_opener::reveal_item_in_dir(&path)
            .map_err(|e| format!("Failed to reveal item in folder: {}", e))
    }
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
