use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexRoot {
    pub path: String,
    pub index_content: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchSettings {
    pub roots: Vec<IndexRoot>,
    pub exclusions: Vec<String>,
    pub max_content_size_mb: u64,
    pub writer_memory_budget_mb: usize,
    pub content_extensions: Vec<String>,
}

impl Default for SearchSettings {
    fn default() -> Self {
        let mut roots = Vec::new();

        // Default root: user profile / home directory (Documents, Downloads, Desktop, etc.)
        // Fast, non-blocking discovery with no drive-letter polling.
        if let Some(home) = dirs::home_dir() {
            let home_str = home.to_string_lossy().to_string();
            roots.push(IndexRoot {
                path: home_str,
                index_content: true,
            });
        }

        let exclusions = vec![
            "node_modules".to_string(),
            ".git".to_string(),
            "target".to_string(),
            "$Recycle.Bin".to_string(),
            "System Volume Information".to_string(),
            "Windows\\WinSxS".to_string(),
            "pagefile.sys".to_string(),
            "hiberfil.sys".to_string(),
            "swapfile.sys".to_string(),
            "AppData\\Local\\Temp".to_string(),
        ];

        let content_extensions = vec![
            "txt", "md", "json", "yaml", "yml", "toml", "ini", "log", "csv", "tsv", "xml", "html",
            "htm", "css", "scss", "sass", "less", "js", "jsx", "ts", "tsx", "rs", "py", "java",
            "c", "cpp", "h", "hpp", "cs", "go", "sql", "sh", "bash", "zsh", "bat", "ps1", "cmd",
            "r", "swift", "kt", "kts", "lua", "vue", "svelte", "lock", "proto",
        ]
        .into_iter()
        .map(String::from)
        .collect();

        Self {
            roots,
            exclusions,
            max_content_size_mb: 2,
            writer_memory_budget_mb: 200,
            content_extensions,
        }
    }
}

impl SearchSettings {
    pub fn get_settings_file_path(app_data_dir: &Path) -> PathBuf {
        app_data_dir.join("search_settings.json")
    }

    pub fn load_or_default(app_data_dir: &Path) -> Self {
        let file_path = Self::get_settings_file_path(app_data_dir);
        if file_path.is_file() {
            if let Ok(content) = fs::read_to_string(&file_path) {
                if let Ok(settings) = serde_json::from_str::<SearchSettings>(&content) {
                    return settings;
                }
            }
        }
        Self::default()
    }

    pub fn save(&self, app_data_dir: &Path) -> Result<(), String> {
        let _ = fs::create_dir_all(app_data_dir);
        let file_path = Self::get_settings_file_path(app_data_dir);
        let content = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize settings: {}", e))?;
        fs::write(&file_path, content).map_err(|e| format!("Failed to write settings file: {}", e))
    }
}
