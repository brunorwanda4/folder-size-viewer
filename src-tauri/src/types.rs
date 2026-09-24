use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum FileCategory {
    Images,
    Video,
    Audio,
    Documents,
    Archives,
    Code,
    #[serde(rename = "Apps & Executables")]
    AppsAndExecutables,
    Databases,
    #[serde(rename = "System & Logs")]
    SystemAndLogs,
    Other,
}

impl FileCategory {
    pub fn as_str(&self) -> &'static str {
        match self {
            FileCategory::Images => "Images",
            FileCategory::Video => "Video",
            FileCategory::Audio => "Audio",
            FileCategory::Documents => "Documents",
            FileCategory::Archives => "Archives",
            FileCategory::Code => "Code",
            FileCategory::AppsAndExecutables => "Apps & Executables",
            FileCategory::Databases => "Databases",
            FileCategory::SystemAndLogs => "System & Logs",
            FileCategory::Other => "Other",
        }
    }
}

pub fn classify(extension: &str) -> FileCategory {
    let ext = extension.trim_start_matches('.').to_lowercase();
    match ext.as_str() {
        // Images
        "png" | "jpg" | "jpeg" | "gif" | "svg" | "webp" | "bmp" | "ico" | "tiff" | "tif"
        | "psd" | "ai" | "raw" | "heic" | "avif" | "jfif" => FileCategory::Images,

        // Video (.ts prioritized for TypeScript under Code)
        "mp4" | "mkv" | "mov" | "avi" | "wmv" | "flv" | "webm" | "m4v" | "3gp" | "mts" | "m2ts"
        | "mpg" | "mpeg" | "vob" => FileCategory::Video,

        // Audio
        "mp3" | "wav" | "flac" | "aac" | "ogg" | "wma" | "m4a" | "opus" | "alac" | "aiff"
        | "mid" | "midi" => FileCategory::Audio,

        // Documents
        "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "txt" | "rtf" | "odt"
        | "ods" | "odp" | "csv" | "tsv" | "md" | "epub" | "pages" | "numbers" | "key" => {
            FileCategory::Documents
        }

        // Archives
        "zip" | "rar" | "7z" | "tar" | "gz" | "bz2" | "xz" | "tgz" | "iso" | "dmg" | "pkg"
        | "deb" | "rpm" | "cab" | "wim" => FileCategory::Archives,

        // Code
        "rs" | "py" | "js" | "jsx" | "ts" | "tsx" | "html" | "htm" | "css" | "scss" | "sass"
        | "less" | "json" | "yaml" | "yml" | "toml" | "xml" | "c" | "cpp" | "h" | "hpp" | "cs"
        | "java" | "kt" | "kts" | "go" | "rb" | "php" | "sh" | "bash" | "zsh" | "ps1" | "bat"
        | "cmd" | "sql" | "r" | "swift" | "dart" | "lua" | "clj" | "scala" | "zig" | "vue"
        | "svelte" | "proto" | "lock" => FileCategory::Code,

        // Apps & Executables
        "exe" | "msi" | "dll" | "so" | "dylib" | "app" | "com" | "scr" | "bin" | "apk" | "jar" => {
            FileCategory::AppsAndExecutables
        }

        // Databases
        "db" | "sqlite" | "sqlite3" | "mdb" | "accdb" | "sqlitedb" | "rdb" | "frm" | "ibd"
        | "mdf" | "ldf" | "ndf" | "dbf" => FileCategory::Databases,

        // System & Logs
        "log" | "sys" | "dat" | "ini" | "cfg" | "conf" | "dump" | "dmp" | "inf" | "reg" | "chk"
        | "bak" | "tmp" | "temp" => FileCategory::SystemAndLogs,

        // Other
        _ => FileCategory::Other,
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryStat {
    pub bytes: u64,
    pub files: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderChildEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size_bytes: u64,
    pub file_count: u64,
    pub modified: Option<u64>, // Unix timestamp in milliseconds
    pub error: Option<String>,
    pub categories: HashMap<String, CategoryStat>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ScanEvent {
    Started {
        total_children: usize,
    },
    ChildDone {
        entry: FolderChildEntry,
    },
    Finished {
        total_size: u64,
        elapsed_ms: u64,
        skipped_count: u64,
        categories: HashMap<String, CategoryStat>,
    },
    Cancelled,
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub path: String,
    pub total_size: u64,
    pub elapsed_ms: u64,
    pub skipped_count: u64,
    pub entries: Vec<FolderChildEntry>,
    pub categories: HashMap<String, CategoryStat>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DefaultPaths {
    pub local_app_data: Option<String>,
    pub app_data: Option<String>,
    pub temp: Option<String>,
    pub home: Option<String>,
    pub downloads: Option<String>,
}
