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

/// Detects all active, mounted drive roots on Windows (e.g. C:\, D:\, G:\)
pub fn detect_system_drives() -> Vec<String> {
    #[cfg(windows)]
    {
        let mut drives = Vec::new();
        for c in b'A'..=b'Z' {
            let drive_path = format!("{}:\\", c as char);
            if Path::new(&drive_path).exists() {
                drives.push(drive_path);
            }
        }
        drives
    }
    #[cfg(not(windows))]
    {
        vec!["/".to_string()]
    }
}

pub fn default_exclusions() -> Vec<String> {
    vec![
        "node_modules".to_string(),
        ".git".to_string(),
        ".svn".to_string(),
        ".hg".to_string(),
        "target".to_string(),
        "dist".to_string(),
        "build".to_string(),
        ".next".to_string(),
        ".nuxt".to_string(),
        ".cache".to_string(),
        "vendor".to_string(),
        "$Recycle.Bin".to_string(),
        "$RECYCLE.BIN".to_string(),
        "System Volume Information".to_string(),
        "Windows".to_string(),
        "WinSxS".to_string(),
        "Program Files".to_string(),
        "Program Files (x86)".to_string(),
        "ProgramData\\Microsoft".to_string(),
        "AppData\\Local\\Temp".to_string(),
        "AppData\\Local\\Microsoft".to_string(),
        "AppData\\Local\\Packages".to_string(),
        "pagefile.sys".to_string(),
        "hiberfil.sys".to_string(),
        "swapfile.sys".to_string(),
        "DumpStack.log".to_string(),
    ]
}

impl Default for SearchSettings {
    fn default() -> Self {
        let mut roots = Vec::new();

        // 1. Primary default root: user profile / home directory (Documents, Downloads, Desktop, etc.)
        if let Some(home) = dirs::home_dir() {
            let home_str = home.to_string_lossy().to_string();
            roots.push(IndexRoot {
                path: home_str,
                index_content: true,
            });
        }

        // 2. Discover and include any secondary drives (e.g. D:\, G:\)
        for drive in detect_system_drives() {
            let drive_upper = drive.to_uppercase();
            if !drive_upper.starts_with("C:")
                && !roots
                    .iter()
                    .any(|r| r.path.to_uppercase().starts_with(&drive_upper))
            {
                roots.push(IndexRoot {
                    path: drive,
                    index_content: true,
                });
            }
        }

        let exclusions = default_exclusions();

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
        let mut settings = if file_path.is_file() {
            if let Ok(content) = fs::read_to_string(&file_path) {
                if let Ok(s) = serde_json::from_str::<SearchSettings>(&content) {
                    s
                } else {
                    Self::default()
                }
            } else {
                Self::default()
            }
        } else {
            Self::default()
        };

        // Ensure default roots exist if empty
        if settings.roots.is_empty() {
            if let Some(home) = dirs::home_dir() {
                settings.roots.push(IndexRoot {
                    path: home.to_string_lossy().to_string(),
                    index_content: true,
                });
            }
        }

        // Auto-add any mounted non-C drives (e.g. G:\) if not already tracked
        for drive in detect_system_drives() {
            let drive_upper = drive.to_uppercase();
            if !drive_upper.starts_with("C:")
                && !settings
                    .roots
                    .iter()
                    .any(|r| r.path.to_uppercase().starts_with(&drive_upper))
            {
                settings.roots.push(IndexRoot {
                    path: drive,
                    index_content: true,
                });
            }
        }

        // Ensure default system exclusions exist if empty
        if settings.exclusions.is_empty() {
            settings.exclusions = default_exclusions();
        }

        settings
    }

    pub fn save(&self, app_data_dir: &Path) -> Result<(), String> {
        let _ = fs::create_dir_all(app_data_dir);
        let file_path = Self::get_settings_file_path(app_data_dir);
        let content = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize settings: {}", e))?;
        fs::write(&file_path, content).map_err(|e| format!("Failed to write settings file: {}", e))
    }
}
