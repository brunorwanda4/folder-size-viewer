use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Instant, UNIX_EPOCH};

use rayon::prelude::*;
use tauri::ipc::Channel;

use crate::types::{classify, CategoryStat, FolderChildEntry, ScanEvent, ScanResult};

/// Expands environment variables like %LOCALAPPDATA% or %USERPROFILE% and tilde ~ paths.
pub fn expand_path(raw: &str) -> PathBuf {
    let mut expanded = raw.trim().to_string();

    // 1. Expand %VAR% tokens
    if expanded.contains('%') {
        let mut result = String::new();
        let mut chars = expanded.chars().peekable();

        while let Some(ch) = chars.next() {
            if ch == '%' {
                let mut var_name = String::new();
                let mut found_closing = false;
                for next_ch in chars.by_ref() {
                    if next_ch == '%' {
                        found_closing = true;
                        break;
                    }
                    var_name.push(next_ch);
                }
                if found_closing && !var_name.is_empty() {
                    if let Ok(val) = std::env::var(&var_name) {
                        result.push_str(&val);
                    } else {
                        result.push('%');
                        result.push_str(&var_name);
                        result.push('%');
                    }
                } else {
                    result.push('%');
                    result.push_str(&var_name);
                }
            } else {
                result.push(ch);
            }
        }
        expanded = result;
    }

    // 2. Expand leading ~ (home directory)
    if expanded == "~" {
        if let Some(home) = dirs::home_dir() {
            return home;
        }
    } else if expanded.starts_with("~/") || expanded.starts_with("~\\") {
        if let Some(home) = dirs::home_dir() {
            return home.join(&expanded[2..]);
        }
    }

    PathBuf::from(expanded)
}

/// Checks whether a path or metadata is a symlink or Windows junction / reparse point.
/// Reparse points (such as "Application Data" inside AppData\Local) cause infinite loops
/// and double counting if recursed into.
pub fn is_reparse_point_or_symlink(meta: &fs::Metadata) -> bool {
    // Standard cross-platform symlink check
    if meta.file_type().is_symlink() {
        return true;
    }

    // On Windows, check FILE_ATTRIBUTE_REPARSE_POINT (0x400)
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x00000400;
        if meta.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
            return true;
        }
    }

    false
}

/// Computes the recursive size, file count, and category breakdown for a directory.
/// Uses an iterative stack walk, skips reparse points/symlinks, and ignores permission errors.
fn compute_folder_recursive(
    folder_path: &Path,
    cancel_token: &Arc<AtomicBool>,
    skipped_count: &AtomicU64,
) -> (u64, u64, HashMap<String, CategoryStat>, Option<String>) {
    let mut total_size: u64 = 0;
    let mut total_files: u64 = 0;
    let mut categories: HashMap<String, CategoryStat> = HashMap::new();
    let mut last_error: Option<String> = None;

    let mut stack: Vec<PathBuf> = vec![folder_path.to_path_buf()];

    while let Some(current_dir) = stack.pop() {
        if cancel_token.load(Ordering::Relaxed) {
            break;
        }

        let read_res = fs::read_dir(&current_dir);
        let entries = match read_res {
            Ok(entries) => entries,
            Err(e) => {
                // Never crash on Access Denied or locked folders: count and continue
                skipped_count.fetch_add(1, Ordering::Relaxed);
                if last_error.is_none() {
                    last_error = Some(e.to_string());
                }
                continue;
            }
        };

        for entry_res in entries {
            if cancel_token.load(Ordering::Relaxed) {
                break;
            }

            let entry = match entry_res {
                Ok(e) => e,
                Err(_) => {
                    skipped_count.fetch_add(1, Ordering::Relaxed);
                    continue;
                }
            };

            let item_path = entry.path();

            // Use symlink_metadata to avoid following symlinks or junctions
            let meta = match fs::symlink_metadata(&item_path) {
                Ok(m) => m,
                Err(_) => {
                    skipped_count.fetch_add(1, Ordering::Relaxed);
                    continue;
                }
            };

            // If it is a reparse point or symlink, do not traverse to avoid recursion loops
            if is_reparse_point_or_symlink(&meta) {
                continue;
            }

            if meta.is_dir() {
                stack.push(item_path);
            } else {
                // Logical file size: Using metadata.len() as required.
                let size = meta.len();
                total_size += size;
                total_files += 1;

                let ext = item_path.extension().and_then(|e| e.to_str()).unwrap_or("");
                let cat = classify(ext);
                let stat = categories.entry(cat.as_str().to_string()).or_default();
                stat.bytes += size;
                stat.files += 1;
            }
        }
    }

    (total_size, total_files, categories, last_error)
}

/// Processes a single immediate child of the scanned directory.
fn process_child_entry(
    child_path: &Path,
    cancel_token: &Arc<AtomicBool>,
    skipped_count: &AtomicU64,
) -> FolderChildEntry {
    let name = child_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| child_path.to_string_lossy().to_string());

    let path_str = child_path.to_string_lossy().to_string();

    let meta_res = fs::symlink_metadata(child_path);
    let meta = match meta_res {
        Ok(m) => m,
        Err(e) => {
            skipped_count.fetch_add(1, Ordering::Relaxed);
            return FolderChildEntry {
                name,
                path: path_str,
                is_dir: false,
                size_bytes: 0,
                file_count: 0,
                modified: None,
                error: Some(e.to_string()),
                categories: HashMap::new(),
            };
        }
    };

    let modified = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64);

    let is_reparse = is_reparse_point_or_symlink(&meta);

    if meta.is_dir() {
        if is_reparse {
            // Reparse point or junction at the root level: do not recurse
            FolderChildEntry {
                name,
                path: path_str,
                is_dir: true,
                size_bytes: 0,
                file_count: 0,
                modified,
                error: Some("Reparse point / Junction (skipped traversal)".to_string()),
                categories: HashMap::new(),
            }
        } else {
            // Compute recursive folder size in parallel thread pool
            let (size_bytes, file_count, categories, error) =
                compute_folder_recursive(child_path, cancel_token, skipped_count);

            FolderChildEntry {
                name,
                path: path_str,
                is_dir: true,
                size_bytes,
                file_count,
                modified,
                error,
                categories,
            }
        }
    } else {
        // Regular file: logical size is metadata.len()
        let mut categories = HashMap::new();
        let ext = child_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");
        let cat = classify(ext);
        categories.insert(
            cat.as_str().to_string(),
            CategoryStat {
                bytes: meta.len(),
                files: 1,
            },
        );

        FolderChildEntry {
            name,
            path: path_str,
            is_dir: false,
            size_bytes: meta.len(),
            file_count: 1,
            modified,
            error: None,
            categories,
        }
    }
}

/// Scans the target directory, emitting events via Channel and returning ScanResult.
pub fn scan_directory(
    raw_path: &str,
    on_event: Channel<ScanEvent>,
    cancel_token: Arc<AtomicBool>,
) -> Result<ScanResult, String> {
    let start_time = Instant::now();
    cancel_token.store(false, Ordering::SeqCst);

    let target_dir = expand_path(raw_path);

    if !target_dir.exists() {
        let msg = format!("Path does not exist: {}", raw_path);
        let _ = on_event.send(ScanEvent::Error {
            message: msg.clone(),
        });
        return Err(msg);
    }

    if !target_dir.is_dir() {
        let msg = format!("Path is not a directory: {}", raw_path);
        let _ = on_event.send(ScanEvent::Error {
            message: msg.clone(),
        });
        return Err(msg);
    }

    // List immediate children
    let entries = fs::read_dir(&target_dir).map_err(|e| {
        let msg = format!("Failed to read directory {}: {}", raw_path, e);
        let _ = on_event.send(ScanEvent::Error {
            message: msg.clone(),
        });
        msg
    })?;

    let mut immediate_children = Vec::new();
    for entry_res in entries {
        if cancel_token.load(Ordering::Relaxed) {
            break;
        }
        if let Ok(entry) = entry_res {
            immediate_children.push(entry.path());
        }
    }

    let total_children = immediate_children.len();
    let _ = on_event.send(ScanEvent::Started { total_children });

    let skipped_count = Arc::new(AtomicU64::new(0));

    // Parallel scanning using Rayon
    // Each child computes in parallel; results are streamed via on_event.send(ChildDone)
    let child_entries: Vec<FolderChildEntry> = immediate_children
        .into_par_iter()
        .filter_map(|child_path| {
            if cancel_token.load(Ordering::Relaxed) {
                return None;
            }

            let entry = process_child_entry(&child_path, &cancel_token, &skipped_count);

            // Stream progress event to frontend immediately as child finishes
            let _ = on_event.send(ScanEvent::ChildDone {
                entry: entry.clone(),
            });

            Some(entry)
        })
        .collect();

    if cancel_token.load(Ordering::Relaxed) {
        let _ = on_event.send(ScanEvent::Cancelled);
        return Err("Scan was cancelled by the user.".to_string());
    }

    let mut total_categories: HashMap<String, CategoryStat> = HashMap::new();
    for entry in &child_entries {
        for (cat, stat) in &entry.categories {
            let entry_stat = total_categories.entry(cat.clone()).or_default();
            entry_stat.bytes += stat.bytes;
            entry_stat.files += stat.files;
        }
    }

    let total_size: u64 = child_entries.iter().map(|e| e.size_bytes).sum();
    let elapsed_ms = start_time.elapsed().as_millis() as u64;
    let final_skipped = skipped_count.load(Ordering::SeqCst);

    let _ = on_event.send(ScanEvent::Finished {
        total_size,
        elapsed_ms,
        skipped_count: final_skipped,
        categories: total_categories.clone(),
    });

    Ok(ScanResult {
        path: target_dir.to_string_lossy().to_string(),
        total_size,
        elapsed_ms,
        skipped_count: final_skipped,
        entries: child_entries,
        categories: total_categories,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::FileCategory;
    use std::fs::File;
    use std::io::Write;

    #[test]
    fn test_classify() {
        assert_eq!(classify("png"), FileCategory::Images);
        assert_eq!(classify(".JPG"), FileCategory::Images);
        assert_eq!(classify("MP4"), FileCategory::Video);
        assert_eq!(classify("mp3"), FileCategory::Audio);
        assert_eq!(classify("pdf"), FileCategory::Documents);
        assert_eq!(classify("zip"), FileCategory::Archives);
        assert_eq!(classify("rs"), FileCategory::Code);
        assert_eq!(classify("exe"), FileCategory::AppsAndExecutables);
        assert_eq!(classify("sqlite"), FileCategory::Databases);
        assert_eq!(classify("log"), FileCategory::SystemAndLogs);
        assert_eq!(classify("unknown_ext_xyz"), FileCategory::Other);
    }

    #[test]
    fn test_expand_path_environment_variable() {
        std::env::set_var("TEST_FSV_VAR", "my_custom_folder");
        let expanded = expand_path("C:\\test\\%TEST_FSV_VAR%\\sub");
        assert_eq!(expanded, PathBuf::from("C:\\test\\my_custom_folder\\sub"));
    }

    #[test]
    fn test_expand_path_tilde() {
        let expanded = expand_path("~/Documents");
        if let Some(home) = dirs::home_dir() {
            assert_eq!(expanded, home.join("Documents"));
        }
    }

    #[test]
    fn test_recursive_folder_size_with_categories() {
        let temp_dir = std::env::temp_dir().join(format!("fsv_test_{}", std::process::id()));
        let _ = fs::remove_dir_all(&temp_dir);
        fs::create_dir_all(&temp_dir).unwrap();

        let sub_dir = temp_dir.join("subdir");
        fs::create_dir_all(&sub_dir).unwrap();

        // Create file 1 (100 bytes txt)
        let file1_path = temp_dir.join("file1.txt");
        let mut f1 = File::create(&file1_path).unwrap();
        f1.write_all(&vec![b'A'; 100]).unwrap();

        // Create file 2 in sub_dir (250 bytes png)
        let file2_path = sub_dir.join("file2.png");
        let mut f2 = File::create(&file2_path).unwrap();
        f2.write_all(&vec![b'B'; 250]).unwrap();

        let cancel_token = Arc::new(AtomicBool::new(false));
        let skipped_count = AtomicU64::new(0);

        let (total_size, total_files, categories, err) =
            compute_folder_recursive(&temp_dir, &cancel_token, &skipped_count);

        assert_eq!(total_size, 350);
        assert_eq!(total_files, 2);
        assert!(err.is_none());
        assert_eq!(skipped_count.load(Ordering::Relaxed), 0);
        assert_eq!(categories.get("Documents").unwrap().bytes, 100);
        assert_eq!(categories.get("Documents").unwrap().files, 1);
        assert_eq!(categories.get("Images").unwrap().bytes, 250);
        assert_eq!(categories.get("Images").unwrap().files, 1);

        // Clean up
        let _ = fs::remove_dir_all(&temp_dir);
    }
}
