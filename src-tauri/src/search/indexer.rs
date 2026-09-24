use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tantivy::schema::{Facet, Value};
use tantivy::{DateTime, Index, IndexReader, ReloadPolicy, TantivyDocument, Term};
use tauri::ipc::Channel;

use crate::search::schema::{
    build_schema, path_to_facet, SearchFields, NAME_ANALYZER, NAME_NGRAM_ANALYZER,
};
use crate::search::settings::SearchSettings;
use crate::search::text_extract::extract_text_content;
use crate::search::tokenizers::{create_name_analyzer, create_ngram_analyzer};
use crate::types::classify;

pub const CURRENT_SCHEMA_VERSION: u32 = 1;
pub const SCHEMA_META_FILENAME: &str = "schema_meta.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexMeta {
    pub schema_version: u32,
    pub last_updated: Option<u64>,
    pub doc_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexStatus {
    pub doc_count: u64,
    pub size_bytes: u64,
    pub last_updated: Option<u64>,
    pub is_indexing: bool,
    pub is_paused: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum IndexEvent {
    Started,
    Progress {
        files_seen: u64,
        files_indexed: u64,
        content_indexed: u64,
        skipped: u64,
        current_path: String,
    },
    Finished {
        total_docs: u64,
        elapsed_ms: u64,
    },
    Cancelled,
    Error {
        message: String,
    },
}

pub struct IndexManager {
    pub index_dir: PathBuf,
    pub index: Index,
    pub reader: IndexReader,
    pub fields: SearchFields,
}

impl IndexManager {
    pub fn open_or_create(app_data_dir: &Path) -> Result<Self, String> {
        let index_dir = app_data_dir.join("index");
        let meta_file = index_dir.join(SCHEMA_META_FILENAME);

        let mut needs_rebuild = true;
        if index_dir.is_dir() && meta_file.is_file() {
            if let Ok(meta_str) = fs::read_to_string(&meta_file) {
                if let Ok(meta) = serde_json::from_str::<IndexMeta>(&meta_str) {
                    if meta.schema_version == CURRENT_SCHEMA_VERSION {
                        needs_rebuild = false;
                    }
                }
            }
        }

        if needs_rebuild && index_dir.exists() {
            let _ = fs::remove_dir_all(&index_dir);
        }
        let _ = fs::create_dir_all(&index_dir);

        let (schema, fields) = build_schema();

        let index = if !needs_rebuild {
            Index::open_in_dir(&index_dir).unwrap_or_else(|_| {
                let _ = fs::remove_dir_all(&index_dir);
                let _ = fs::create_dir_all(&index_dir);
                Index::create_in_dir(&index_dir, schema.clone())
                    .expect("Failed to create tantivy index directory")
            })
        } else {
            Index::create_in_dir(&index_dir, schema.clone())
                .map_err(|e| format!("Failed to create Tantivy index: {}", e))?
        };

        // Register custom tokenizers
        index
            .tokenizers()
            .register(NAME_ANALYZER, create_name_analyzer());
        let ngram_analyzer = create_ngram_analyzer()
            .map_err(|e| format!("Failed to create ngram analyzer: {}", e))?;
        index
            .tokenizers()
            .register(NAME_NGRAM_ANALYZER, ngram_analyzer);

        let reader = index
            .reader_builder()
            .reload_policy(ReloadPolicy::Manual)
            .try_into()
            .map_err(|e| format!("Failed to create IndexReader: {}", e))?;

        if needs_rebuild {
            let meta = IndexMeta {
                schema_version: CURRENT_SCHEMA_VERSION,
                last_updated: None,
                doc_count: 0,
            };
            let _ = fs::write(
                &meta_file,
                serde_json::to_string_pretty(&meta).unwrap_or_default(),
            );
        }

        Ok(Self {
            index_dir,
            index,
            reader,
            fields,
        })
    }

    pub fn get_status(&self, is_indexing: bool, is_paused: bool) -> IndexStatus {
        let meta_file = self.index_dir.join(SCHEMA_META_FILENAME);
        let mut last_updated = None;
        let mut doc_count = 0;

        if let Ok(content) = fs::read_to_string(&meta_file) {
            if let Ok(meta) = serde_json::from_str::<IndexMeta>(&content) {
                last_updated = meta.last_updated;
                doc_count = meta.doc_count;
            }
        }

        if doc_count == 0 {
            let searcher = self.reader.searcher();
            doc_count = searcher.num_docs();
        }

        let size_bytes = get_dir_size(&self.index_dir);

        IndexStatus {
            doc_count,
            size_bytes,
            last_updated,
            is_indexing,
            is_paused,
        }
    }
}

fn get_dir_size(path: &Path) -> u64 {
    let mut total = 0;
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Ok(meta) = entry.metadata() {
                if meta.is_file() {
                    total += meta.len();
                } else if meta.is_dir() {
                    total += get_dir_size(&entry.path());
                }
            }
        }
    }
    total
}

/// Runs indexing pipeline (full rebuild or incremental)
pub fn run_indexing(
    manager: &IndexManager,
    settings: &SearchSettings,
    rebuild: bool,
    on_event: &Channel<IndexEvent>,
    cancel_token: Arc<AtomicBool>,
    pause_token: Arc<AtomicBool>,
) -> Result<u64, String> {
    let start_time = Instant::now();
    let _ = on_event.send(IndexEvent::Started);

    #[cfg(windows)]
    unsafe {
        use windows_sys::Win32::System::Threading::{
            GetCurrentThread, SetThreadPriority, THREAD_PRIORITY_BELOW_NORMAL,
        };
        SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_BELOW_NORMAL);
    }

    let memory_budget = (settings.writer_memory_budget_mb * 1024 * 1024).max(30_000_000);
    let mut writer = manager
        .index
        .writer(memory_budget)
        .map_err(|e| format!("Failed to create IndexWriter: {}", e))?;

    if rebuild {
        writer
            .delete_all_documents()
            .map_err(|e| format!("Failed to delete existing documents: {}", e))?;
    }

    // Incremental update mechanism:
    // We populate an in-memory lookup table of (path -> (modified_timestamp, file_size))
    // from the current index segment readers.
    // During disk traversal:
    // - If a file exists in the map with identical modified time and size, we skip indexing it entirely.
    // - If the file has changed (different modified time or size), we delete the old document by path term and re-index.
    // - If the file is new, we index it.
    // - Any path seen on disk is marked in a `seen` set.
    // After disk traversal completes:
    // - Any path in the original lookup table that was NOT seen on disk (and belongs to one of the crawled root folders)
    //   is detected as deleted and removed from the Tantivy index.
    // This provides fast, incremental re-indexing without having to rescan or re-read unchanged files.
    let mut existing_docs: HashMap<String, (u64, u64)> = HashMap::new();
    if !rebuild {
        let searcher = manager.reader.searcher();
        for segment_reader in searcher.segment_readers() {
            let store_reader = segment_reader.get_store_reader(100).ok();
            if let Some(store) = store_reader {
                for doc_id in 0..segment_reader.max_doc() {
                    if segment_reader.is_deleted(doc_id) {
                        continue;
                    }
                    if let Ok(doc) = store.get::<TantivyDocument>(doc_id) {
                        if let Some(path_val) =
                            doc.get_first(manager.fields.path).and_then(|v| v.as_str())
                        {
                            let size = doc
                                .get_first(manager.fields.size)
                                .and_then(|v| v.as_u64())
                                .unwrap_or(0);
                            let modified = doc
                                .get_first(manager.fields.modified)
                                .and_then(|v| v.as_datetime())
                                .map(|dt| dt.into_timestamp_millis() as u64)
                                .unwrap_or(0);
                            existing_docs.insert(path_val.to_string(), (modified, size));
                        }
                    }
                }
            }
        }
    }

    let mut seen_paths: HashSet<String> = HashSet::new();

    let mut files_seen: u64 = 0;
    let mut files_indexed: u64 = 0;
    let mut content_indexed: u64 = 0;
    let mut skipped: u64 = 0;

    let mut last_progress = Instant::now();
    let mut last_commit = Instant::now();
    let mut docs_since_commit: u64 = 0;

    let max_content_bytes = settings.max_content_size_mb * 1024 * 1024;
    let exclusions_lower: Vec<String> = settings
        .exclusions
        .iter()
        .map(|s| s.to_lowercase())
        .collect();

    for root in &settings.roots {
        if cancel_token.load(Ordering::SeqCst) {
            let _ = on_event.send(IndexEvent::Cancelled);
            return Ok(files_indexed);
        }

        let root_path = Path::new(&root.path);
        if !root_path.exists() {
            continue;
        }

        // Parallel walk using jwalk, skipping symlinks/junctions
        let walker = jwalk::WalkDir::new(root_path)
            .skip_hidden(false)
            .follow_links(false);

        for entry_res in walker {
            // Handle pause
            while pause_token.load(Ordering::SeqCst) && !cancel_token.load(Ordering::SeqCst) {
                std::thread::sleep(Duration::from_millis(200));
            }

            // Handle cancellation
            if cancel_token.load(Ordering::SeqCst) {
                let _ = on_event.send(IndexEvent::Cancelled);
                return Ok(files_indexed);
            }

            let entry = match entry_res {
                Ok(e) => e,
                Err(_) => {
                    skipped += 1;
                    continue;
                }
            };

            files_seen += 1;

            let path = entry.path();
            let path_str = path.to_string_lossy().to_string();

            // Skip reparse points/symlinks
            if entry.file_type.is_symlink() {
                skipped += 1;
                continue;
            }

            // Exclusions check
            let name = match path.file_name().and_then(|n| n.to_str()) {
                Some(n) => n,
                None => {
                    skipped += 1;
                    continue;
                }
            };

            let name_lower = name.to_lowercase();
            if exclusions_lower
                .iter()
                .any(|ex| name_lower == *ex || path_str.to_lowercase().contains(ex))
            {
                skipped += 1;
                continue;
            }

            let is_dir = entry.file_type.is_dir();
            let metadata = match fs::metadata(&path) {
                Ok(m) => m,
                Err(_) => {
                    skipped += 1;
                    continue;
                }
            };

            let size = if is_dir { 0 } else { metadata.len() };
            let modified = metadata
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);

            seen_paths.insert(path_str.clone());

            // Incremental check: has file changed?
            if let Some(&(old_modified, old_size)) = existing_docs.get(&path_str) {
                if old_modified == modified && old_size == size {
                    // Unchanged, skip re-indexing
                    continue;
                }
                // File modified, remove previous document
                let path_term = Term::from_field_text(manager.fields.path, &path_str);
                writer.delete_term(path_term);
            }

            // Build TantivyDocument
            let mut doc = TantivyDocument::default();
            doc.add_text(manager.fields.name, name);
            doc.add_text(manager.fields.name_ngram, name);
            doc.add_text(manager.fields.path, &path_str);
            doc.add_bool(manager.fields.is_dir, is_dir);
            doc.add_u64(manager.fields.size, size);
            doc.add_date(
                manager.fields.modified,
                DateTime::from_timestamp_millis(modified as i64),
            );

            // Dir facet
            let parent_dir = path.parent().unwrap_or(root_path);
            let facet: Facet = path_to_facet(parent_dir);
            doc.add_facet(manager.fields.dir, facet);

            let ext = if is_dir {
                String::new()
            } else {
                path.extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("")
                    .to_lowercase()
            };
            doc.add_text(manager.fields.ext, &ext);

            let category = if is_dir {
                "Folder".to_string()
            } else {
                classify(&ext).as_str().to_string()
            };
            doc.add_text(manager.fields.category, &category);

            // Index content for text-like files if enabled for this root
            if !is_dir && root.index_content {
                if let Some(content) =
                    extract_text_content(&path, max_content_bytes, &settings.content_extensions)
                {
                    doc.add_text(manager.fields.content, &content);
                    content_indexed += 1;
                }
            }

            if let Err(e) = writer.add_document(doc) {
                eprintln!("Error adding document {}: {}", path_str, e);
                skipped += 1;
                continue;
            }

            files_indexed += 1;
            docs_since_commit += 1;

            // Commit every ~10,000 documents or 10 seconds
            let now = Instant::now();
            if docs_since_commit >= 10_000
                || now.duration_since(last_commit) >= Duration::from_secs(10)
            {
                if let Ok(_) = writer.commit() {
                    let _ = manager.reader.reload();
                    last_commit = Instant::now();
                    docs_since_commit = 0;
                }
            }

            // Progress event throttled to ~200ms
            if now.duration_since(last_progress) >= Duration::from_millis(200) {
                let _ = on_event.send(IndexEvent::Progress {
                    files_seen,
                    files_indexed,
                    content_indexed,
                    skipped,
                    current_path: path_str,
                });
                last_progress = Instant::now();
            }
        }
    }

    // Clean up deleted files:
    // Any file in `existing_docs` not found in `seen_paths` (that was within the crawled roots) is deleted
    for (old_path, _) in &existing_docs {
        if !seen_paths.contains(old_path) {
            let path_obj = Path::new(old_path);
            let in_active_roots = settings.roots.iter().any(|r| path_obj.starts_with(&r.path));
            if in_active_roots {
                let path_term = Term::from_field_text(manager.fields.path, old_path);
                writer.delete_term(path_term);
            }
        }
    }

    // Final commit and reload
    writer
        .commit()
        .map_err(|e| format!("Failed to commit index: {}", e))?;
    let _ = manager.reader.reload();

    let searcher = manager.reader.searcher();
    let total_docs = searcher.num_docs();

    // Update schema_meta.json
    let meta = IndexMeta {
        schema_version: CURRENT_SCHEMA_VERSION,
        last_updated: Some(
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
        ),
        doc_count: total_docs,
    };
    let meta_file = manager.index_dir.join(SCHEMA_META_FILENAME);
    let _ = fs::write(
        &meta_file,
        serde_json::to_string_pretty(&meta).unwrap_or_default(),
    );

    let elapsed_ms = start_time.elapsed().as_millis() as u64;
    let _ = on_event.send(IndexEvent::Finished {
        total_docs,
        elapsed_ms,
    });

    Ok(total_docs)
}
