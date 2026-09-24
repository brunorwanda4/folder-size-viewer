use serde::{Deserialize, Serialize};

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
