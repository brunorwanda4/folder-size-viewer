use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tantivy::collector::{Count, TopDocs};
use tantivy::query::{BooleanQuery, Occur, Query, QueryParser, TermQuery};
use tantivy::schema::{IndexRecordOption, Value};
use tantivy::snippet::SnippetGenerator;
use tantivy::{Index, Searcher, Term};
use tauri::ipc::Channel;

use crate::search::schema::{path_to_facet, SearchFields};
use crate::search::text_extract::extract_text_content;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnippetResult {
    pub text: String,
    pub highlights: Vec<[usize; 2]>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size_bytes: u64,
    pub modified: Option<u64>,
    pub category: String,
    pub snippet: Option<SnippetResult>,
    pub matched_name_ranges: Vec<[usize; 2]>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub hits: Vec<SearchHit>,
    pub total: usize,
    pub took_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum SearchStreamEvent {
    Batch {
        hits: Vec<SearchHit>,
        total: usize,
        took_ms: u64,
    },
    Done {
        total: usize,
        took_ms: u64,
    },
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchParams {
    pub query: String,
    pub scope: String, // "computer" | "folder"
    pub current_path: Option<String>,
    pub mode: String,                // "both" | "names" | "contents"
    pub filter_type: Option<String>, // "all" | "files" | "folders"
    pub filter_category: Option<String>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

/// Preprocesses the user query before passing to Tantivy QueryParser:
/// - Handles Windows path separators and drive letters.
/// - Replaces hyphens inside words/dates (e.g. 2026-09-21) with spaces so Tantivy does not treat them as MUST_NOT negation.
/// - Replaces colons in non-field terms (e.g. timestamps like "03:26:21" or Windows drive paths).
/// - Keeps valid field specifiers like `name:`, `content:`, `ext:`, `path:`, `dir:`, `category:`.
pub fn sanitize_query(raw: &str) -> String {
    let known_fields = ["name", "content", "ext", "path", "dir", "category"];
    let mut words = Vec::new();

    let raw = raw.trim_matches(['"', '\'', '`']);

    for word in raw.split_whitespace() {
        // If word is a Windows path like C:\Users\... or /home/...
        if word.contains('\\') || word.contains('/') {
            for seg in word.split(['\\', '/']) {
                let clean_seg = seg.trim_matches(['"', '\'', '(', ')', ':', ';']);
                if !clean_seg.is_empty() {
                    words.push(clean_seg.to_string());
                }
            }
            continue;
        }

        if let Some((prefix, _suffix)) = word.split_once(':') {
            let clean_prefix = prefix.trim_start_matches(['+', '-', '"', '\'', '(']);
            if !known_fields
                .iter()
                .any(|&f| f.eq_ignore_ascii_case(clean_prefix))
            {
                // Not a known schema field: replace ':' with space so Tantivy doesn't fail parsing
                let sanitized_word = word.replace(':', " ");
                words.push(sanitized_word);
                continue;
            }
        }

        // If word has internal hyphens (like 2026-09-21 or foo-bar), replace with space so Tantivy doesn't parse -09 as NOT
        if word.contains('-') && !word.starts_with('-') {
            let sanitized_word = word.replace('-', " ");
            words.push(sanitized_word);
            continue;
        }

        words.push(word.to_string());
    }

    words.join(" ")
}

pub fn execute_search(
    index: &Index,
    searcher: &Searcher,
    fields: &SearchFields,
    params: SearchParams,
    roots: &[String],
    exclusions: &[String],
    content_extensions: &[String],
    max_content_size_mb: u64,
) -> Result<SearchResult, String> {
    let start_time = Instant::now();
    let query_str = params.query.trim();

    if query_str.is_empty() {
        return Ok(SearchResult {
            hits: Vec::new(),
            total: 0,
            took_ms: start_time.elapsed().as_millis() as u64,
        });
    }

    let sanitized_query_str = sanitize_query(query_str);

    let limit = params.limit.unwrap_or(50).max(1);
    let offset = params.offset.unwrap_or(0);

    // 1. Choose query fields and field boosts based on Search Mode
    let mut query_fields = Vec::new();
    match params.mode.as_str() {
        "names" => {
            query_fields.push(fields.name);
            query_fields.push(fields.name_ngram);
        }
        "contents" => {
            query_fields.push(fields.content);
        }
        _ => {
            // "both"
            query_fields.push(fields.name);
            query_fields.push(fields.name_ngram);
            query_fields.push(fields.content);
        }
    }

    let mut query_parser = QueryParser::for_index(index, query_fields);
    query_parser.set_field_boost(fields.name, 3.0);
    query_parser.set_field_boost(fields.name_ngram, 1.5);
    query_parser.set_field_boost(fields.content, 1.0);
    query_parser.set_conjunction_by_default(); // Multiple terms mean AND

    // Lenient mode so half-typed input never errors
    let (user_query, _errors) = query_parser.parse_query_lenient(&sanitized_query_str);

    // 2. Build BooleanQuery with scope & filter clauses
    let mut clauses: Vec<(Occur, Box<dyn Query>)> = vec![(Occur::Must, user_query.box_clone())];

    // Scope filter: Current Folder
    if params.scope == "folder" {
        if let Some(curr_path) = params.current_path.as_deref() {
            if !curr_path.trim().is_empty() {
                let facet = path_to_facet(Path::new(curr_path));
                let term = Term::from_facet(fields.dir, &facet);
                let term_query = TermQuery::new(term, IndexRecordOption::Basic);
                clauses.push((Occur::Must, Box::new(term_query)));
            }
        }
    }

    // Type filter: Files vs Folders
    if let Some(ftype) = params.filter_type.as_deref() {
        match ftype {
            "files" => {
                let term = Term::from_field_bool(fields.is_dir, false);
                clauses.push((
                    Occur::Must,
                    Box::new(TermQuery::new(term, IndexRecordOption::Basic)),
                ));
            }
            "folders" => {
                let term = Term::from_field_bool(fields.is_dir, true);
                clauses.push((
                    Occur::Must,
                    Box::new(TermQuery::new(term, IndexRecordOption::Basic)),
                ));
            }
            _ => {}
        }
    }

    // Category filter
    if let Some(cat) = params.filter_category.as_deref() {
        if cat != "all" && !cat.trim().is_empty() {
            let term = Term::from_field_text(fields.category, cat);
            clauses.push((
                Occur::Must,
                Box::new(TermQuery::new(term, IndexRecordOption::Basic)),
            ));
        }
    }

    let final_query = BooleanQuery::new(clauses);

    // 3. Execute query with TopDocs collector
    let top_docs_collector = TopDocs::with_limit(limit)
        .and_offset(offset)
        .order_by_score();

    let (top_docs, total_count) = searcher
        .search(&final_query, &(top_docs_collector, Count))
        .map_err(|e| format!("Search failed: {}", e))?;

    // 4. Transform documents to SearchHit objects
    let mut snippet_generator = None;
    if params.mode != "names" {
        if let Ok(gen) = SnippetGenerator::create(searcher, &*user_query, fields.content) {
            snippet_generator = Some(gen);
        }
    }

    let max_bytes = max_content_size_mb * 1024 * 1024;
    let query_terms = extract_search_terms(query_str);

    let mut hits = Vec::new();

    // Check if query is an exact existing file or directory path on disk
    let clean_query = query_str.trim_matches(['"', '\'', '`']);
    let direct_path = Path::new(clean_query);
    if offset == 0 && direct_path.exists() {
        let path_str = direct_path.to_string_lossy().to_string();
        let is_dir = direct_path.is_dir();
        let name = direct_path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| path_str.clone());
        let ext = direct_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_string();
        let category = if is_dir {
            "Folder".to_string()
        } else {
            crate::types::classify(&ext).as_str().to_string()
        };
        let meta = direct_path.metadata().ok();
        let size_bytes = if is_dir {
            0
        } else {
            meta.as_ref().map(|m| m.len()).unwrap_or(0)
        };
        let modified = meta
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64);

        hits.push(SearchHit {
            name,
            path: path_str,
            is_dir,
            size_bytes,
            modified,
            category,
            snippet: None,
            matched_name_ranges: Vec::new(),
        });
    }

    for (_score, doc_address) in top_docs {
        let doc: tantivy::TantivyDocument = match searcher.doc(doc_address) {
            Ok(d) => d,
            Err(_) => continue,
        };

        let name = doc
            .get_first(fields.name)
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let path = doc
            .get_first(fields.path)
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        if hits.iter().any(|h| h.path.eq_ignore_ascii_case(&path)) {
            continue;
        }

        let is_dir = doc
            .get_first(fields.is_dir)
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        let size_bytes = doc
            .get_first(fields.size)
            .and_then(|v| v.as_u64())
            .unwrap_or(0);

        let modified = doc
            .get_first(fields.modified)
            .and_then(|v| v.as_datetime())
            .map(|dt| dt.into_timestamp_millis() as u64);

        let category = doc
            .get_first(fields.category)
            .and_then(|v| v.as_str())
            .unwrap_or("Other")
            .to_string();

        let mut snippet_result = None;
        if !is_dir && hits.len() < 5 {
            if let Some(ref snip_gen) = snippet_generator {
                let file_path = Path::new(&path);
                if let Some(content) =
                    extract_text_content(file_path, max_bytes, content_extensions)
                {
                    let snip = snip_gen.snippet(&content);
                    let fragment = snip.fragment();
                    let highlighted = snip.highlighted();
                    if !fragment.is_empty() && !highlighted.is_empty() {
                        let ranges = highlighted.iter().map(|r| [r.start, r.end]).collect();
                        snippet_result = Some(SnippetResult {
                            text: fragment.to_string(),
                            highlights: ranges,
                        });
                    }
                }
            }
        }

        let matched_name_ranges = find_matched_ranges(&name, &query_terms);

        hits.push(SearchHit {
            name,
            path,
            is_dir,
            size_bytes,
            modified,
            category,
            snippet: snippet_result,
            matched_name_ranges,
        });
    }

    // 5. Live filesystem search fallback:
    // If index had 0 results (unindexed files or empty index), search filesystem directly.
    if hits.is_empty() && limit > 0 {
        let mut existing_paths: std::collections::HashSet<String> = hits
            .iter()
            .map(|h| {
                #[cfg(windows)]
                {
                    h.path.to_lowercase()
                }
                #[cfg(not(windows))]
                {
                    h.path.clone()
                }
            })
            .collect();

        let live_hits = live_filesystem_search(
            &params,
            roots,
            exclusions,
            &mut existing_paths,
            limit,
            std::time::Duration::from_millis(3000),
        );
        hits.extend(live_hits);
    }

    let total = (total_count as usize).max(hits.len());

    Ok(SearchResult {
        hits,
        total,
        took_ms: start_time.elapsed().as_millis() as u64,
    })
}

/// Determines prioritized search roots:
/// Respects configured roots, and if a root is the user's home directory,
/// common user subfolders (Downloads, Desktop, Documents, Pictures, Videos, Music)
/// are placed FIRST so users find everyday files in milliseconds.
pub fn get_prioritized_search_roots(
    params: &SearchParams,
    configured_roots: &[String],
) -> Vec<PathBuf> {
    if params.scope == "folder" {
        if let Some(ref folder) = params.current_path {
            let p = PathBuf::from(folder);
            if p.is_dir() {
                return vec![p];
            }
        }
        return Vec::new();
    }

    let mut roots = Vec::new();

    // If query references an existing directory (e.g. C:\Users\foo\Downloads\file)
    let clean_q = params.query.trim_matches(['"', '\'', '`']);
    let q_path = Path::new(clean_q);
    if let Some(parent) = q_path.parent() {
        if parent.is_dir() {
            roots.push(parent.to_path_buf());
        }
    }

    let home_opt = dirs::home_dir();

    for r in configured_roots {
        let p = PathBuf::from(r);
        if !p.is_dir() {
            continue;
        }

        // If this configured root is the user's home directory, prioritize common user subfolders
        let is_home = home_opt.as_ref().map(|h| h == &p).unwrap_or(false);
        if is_home {
            let subfolders = ["Downloads", "Desktop", "Documents", "Pictures", "Videos", "Music"];
            for sub in subfolders {
                let sub_p = p.join(sub);
                if sub_p.is_dir() && !roots.contains(&sub_p) {
                    roots.push(sub_p);
                }
            }
        }

        if !roots.contains(&p) {
            roots.push(p);
        }
    }

    roots
}

/// High-performance live filesystem search that scans directory trees for files matching search terms.
/// Excludes build artifacts, version control dirs, and system folders immediately at directory boundaries.
pub fn live_filesystem_search(
    params: &SearchParams,
    configured_roots: &[String],
    exclusions: &[String],
    existing_paths: &mut std::collections::HashSet<String>,
    limit: usize,
    max_duration: std::time::Duration,
) -> Vec<SearchHit> {
    if limit == 0 {
        return Vec::new();
    }

    let start_time = Instant::now();
    let query_str = params.query.trim();
    let query_terms = extract_search_terms(query_str);
    if query_terms.is_empty() {
        return Vec::new();
    }

    let search_roots = get_prioritized_search_roots(params, configured_roots);
    if search_roots.is_empty() {
        return Vec::new();
    }

    // Separate simple folder exclusions (e.g. "node_modules") from path-based ones (e.g. "AppData\Local\Temp")
    let exclusions_simple: Vec<String> = exclusions
        .iter()
        .filter(|e| !e.contains('\\') && !e.contains('/'))
        .map(|e| e.to_lowercase())
        .collect();

    let exclusions_path: Vec<String> = exclusions
        .iter()
        .filter(|e| e.contains('\\') || e.contains('/'))
        .map(|e| e.to_lowercase())
        .collect();

    let filter_type = params.filter_type.as_deref().unwrap_or("all");
    let filter_category = params.filter_category.as_deref().unwrap_or("all");

    let required_ext = query_str
        .split_whitespace()
        .find_map(|w| w.strip_prefix("ext:"))
        .map(|e| e.trim_matches(['\"', '\'']).to_lowercase());

    let mut live_hits = Vec::new();

    for root_dir in search_roots {
        if start_time.elapsed() >= max_duration || live_hits.len() >= limit {
            break;
        }

        let simple_ex = exclusions_simple.clone();
        let walker = jwalk::WalkDirGeneric::<((), bool)>::new(&root_dir)
            .skip_hidden(false)
            .follow_links(false)
            .process_read_dir(move |_depth, _path, _state, children| {
                children.retain(|child_res| {
                    if let Ok(child) = child_res {
                        if child.file_type.is_dir() {
                            let name_lower = child.file_name.to_string_lossy().to_lowercase();
                            if simple_ex.iter().any(|ex| name_lower == *ex) {
                                return false;
                            }
                        }
                    }
                    true
                });
            });

        for entry_res in walker {
            if start_time.elapsed() >= max_duration || live_hits.len() >= limit {
                break;
            }

            let entry = match entry_res {
                Ok(e) => e,
                Err(_) => continue,
            };

            let path = entry.path();
            let path_str = path.to_string_lossy().to_string();

            #[cfg(windows)]
            let key = path_str.to_lowercase();
            #[cfg(not(windows))]
            let key = path_str.clone();

            if existing_paths.contains(&key) {
                continue;
            }

            let is_dir = entry.file_type.is_dir();

            // Type filter
            match filter_type {
                "files" if is_dir => continue,
                "folders" if !is_dir => continue,
                _ => {}
            }

            // Path-based exclusions check
            let path_lower = path_str.to_lowercase();
            if exclusions_path.iter().any(|ex| path_lower.contains(ex)) {
                continue;
            }

            let file_name = match path.file_name() {
                Some(n) => n.to_string_lossy().to_string(),
                None => continue,
            };

            let name_lower = file_name.to_lowercase();

            // Check ext: filter if present
            if let Some(ref req_ext) = required_ext {
                let actual_ext = path
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("")
                    .to_lowercase();
                if actual_ext != *req_ext {
                    continue;
                }
            }

            // Match checking: All query terms must match in either the file name or the full path
            let matches = query_terms
                .iter()
                .all(|term| name_lower.contains(term) || path_lower.contains(term));

            if !matches {
                continue;
            }

            // Category filter
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_string();

            let category = if is_dir {
                "Folder".to_string()
            } else {
                crate::types::classify(&ext).as_str().to_string()
            };

            if filter_category != "all" && !filter_category.is_empty() {
                if !category.eq_ignore_ascii_case(filter_category) {
                    continue;
                }
            }

            // Gather metadata
            let metadata = entry.metadata().ok();
            let size_bytes = if is_dir {
                0
            } else {
                metadata.as_ref().map(|m| m.len()).unwrap_or(0)
            };

            let modified = metadata
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64);

            let matched_name_ranges = find_matched_ranges(&file_name, &query_terms);

            existing_paths.insert(key);

            live_hits.push(SearchHit {
                name: file_name,
                path: path_str,
                is_dir,
                size_bytes,
                modified,
                category,
                snippet: None,
                matched_name_ranges,
            });
        }
    }

    live_hits
}

/// Progressive streaming live filesystem search.
/// Batches results in groups of `batch_size` (configured by user) and emits them via `Channel`
/// in real time so the user sees results immediately as they are discovered.
pub fn stream_live_filesystem_search(
    params: SearchParams,
    configured_roots: Vec<String>,
    exclusions: Vec<String>,
    mut existing_paths: std::collections::HashSet<String>,
    batch_size: usize,
    on_event: Channel<SearchStreamEvent>,
    active_token: Arc<AtomicU64>,
    search_token: u64,
    mut total_found: usize,
    start_time: Instant,
) {
    let query_str = params.query.trim();
    let query_terms = extract_search_terms(query_str);
    if query_terms.is_empty() {
        let _ = on_event.send(SearchStreamEvent::Done {
            total: total_found,
            took_ms: start_time.elapsed().as_millis() as u64,
        });
        return;
    }

    let search_roots = get_prioritized_search_roots(&params, &configured_roots);
    if search_roots.is_empty() {
        let _ = on_event.send(SearchStreamEvent::Done {
            total: total_found,
            took_ms: start_time.elapsed().as_millis() as u64,
        });
        return;
    }

    let exclusions_simple: Vec<String> = exclusions
        .iter()
        .filter(|e| !e.contains('\\') && !e.contains('/'))
        .map(|e| e.to_lowercase())
        .collect();

    let exclusions_path: Vec<String> = exclusions
        .iter()
        .filter(|e| e.contains('\\') || e.contains('/'))
        .map(|e| e.to_lowercase())
        .collect();

    let filter_type = params.filter_type.as_deref().unwrap_or("all");
    let filter_category = params.filter_category.as_deref().unwrap_or("all");

    let required_ext = query_str
        .split_whitespace()
        .find_map(|w| w.strip_prefix("ext:"))
        .map(|e| e.trim_matches(['\"', '\'']).to_lowercase());

    let mut current_batch = Vec::with_capacity(batch_size);
    let max_results_cap = 5000;

    for root_dir in search_roots {
        if active_token.load(Ordering::Relaxed) != search_token {
            return;
        }

        if total_found >= max_results_cap {
            break;
        }

        let simple_ex = exclusions_simple.clone();
        let walker = jwalk::WalkDirGeneric::<((), bool)>::new(&root_dir)
            .skip_hidden(false)
            .follow_links(false)
            .process_read_dir(move |_depth, _path, _state, children| {
                children.retain(|child_res| {
                    if let Ok(child) = child_res {
                        if child.file_type.is_dir() {
                            let name_lower = child.file_name.to_string_lossy().to_lowercase();
                            if simple_ex.iter().any(|ex| name_lower == *ex) {
                                return false;
                            }
                        }
                    }
                    true
                });
            });

        for entry_res in walker {
            if active_token.load(Ordering::Relaxed) != search_token {
                return;
            }

            if total_found >= max_results_cap {
                break;
            }

            let entry = match entry_res {
                Ok(e) => e,
                Err(_) => continue,
            };

            let path = entry.path();
            let path_str = path.to_string_lossy().to_string();

            #[cfg(windows)]
            let key = path_str.to_lowercase();
            #[cfg(not(windows))]
            let key = path_str.clone();

            if existing_paths.contains(&key) {
                continue;
            }

            let is_dir = entry.file_type.is_dir();

            // Type filter
            match filter_type {
                "files" if is_dir => continue,
                "folders" if !is_dir => continue,
                _ => {}
            }

            // Path-based exclusions check
            let path_lower = path_str.to_lowercase();
            if exclusions_path.iter().any(|ex| path_lower.contains(ex)) {
                continue;
            }

            let file_name = match path.file_name() {
                Some(n) => n.to_string_lossy().to_string(),
                None => continue,
            };

            let name_lower = file_name.to_lowercase();

            // Check ext: filter if present
            if let Some(ref req_ext) = required_ext {
                let actual_ext = path
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("")
                    .to_lowercase();
                if actual_ext != *req_ext {
                    continue;
                }
            }

            // Match checking: All query terms must match in either the file name or the full path
            let matches = query_terms
                .iter()
                .all(|term| name_lower.contains(term) || path_lower.contains(term));

            if !matches {
                continue;
            }

            // Category filter
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_string();

            let category = if is_dir {
                "Folder".to_string()
            } else {
                crate::types::classify(&ext).as_str().to_string()
            };

            if filter_category != "all" && !filter_category.is_empty() {
                if !category.eq_ignore_ascii_case(filter_category) {
                    continue;
                }
            }

            // Gather metadata
            let metadata = entry.metadata().ok();
            let size_bytes = if is_dir {
                0
            } else {
                metadata.as_ref().map(|m| m.len()).unwrap_or(0)
            };

            let modified = metadata
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64);

            let matched_name_ranges = find_matched_ranges(&file_name, &query_terms);

            existing_paths.insert(key);
            total_found += 1;

            current_batch.push(SearchHit {
                name: file_name,
                path: path_str,
                is_dir,
                size_bytes,
                modified,
                category,
                snippet: None,
                matched_name_ranges,
            });

            if current_batch.len() >= batch_size {
                let batch = std::mem::take(&mut current_batch);
                let _ = on_event.send(SearchStreamEvent::Batch {
                    hits: batch,
                    total: total_found,
                    took_ms: start_time.elapsed().as_millis() as u64,
                });
            }
        }
    }

    if active_token.load(Ordering::Relaxed) != search_token {
        return;
    }

    // Flush remaining buffered batch
    if !current_batch.is_empty() {
        let _ = on_event.send(SearchStreamEvent::Batch {
            hits: current_batch,
            total: total_found,
            took_ms: start_time.elapsed().as_millis() as u64,
        });
    }

    // Emit final Done event
    let _ = on_event.send(SearchStreamEvent::Done {
        total: total_found,
        took_ms: start_time.elapsed().as_millis() as u64,
    });
}

/// Extracts search terms (excluding field operators like ext:pdf or dir:) for filename & path matching
pub fn extract_search_terms(query: &str) -> Vec<String> {
    let mut terms = Vec::new();
    let clean = query.trim_matches(['\"', '\'', '`']);

    for part in clean.split_whitespace() {
        let part = part.trim_matches(['\"', '\'', '(', ')', ',', ';']);
        if part.is_empty() {
            continue;
        }

        // If it's a field query like name:foo or ext:pdf
        if let Some((field, val)) = part.split_once(':') {
            let field_lower = field.to_lowercase();
            if field_lower == "ext" || field_lower == "name" || field_lower == "content" {
                let v = val.trim_matches(['\"', '\'', '(', ')', ',', ';']);
                if !v.is_empty() {
                    terms.push(v.to_lowercase());
                }
                continue;
            } else if field.len() == 1 && field.chars().next().unwrap().is_ascii_alphabetic() {
                // Windows drive letter like C:\path\file
                let remainder = val.trim_matches(['\"', '\'', '(', ')', ',', ';']);
                for sub in remainder.split(['\\', '/']) {
                    let sub = sub.trim_matches(['\"', '\'', '(', ')', ',', ';']);
                    if !sub.is_empty() {
                        terms.push(sub.to_lowercase());
                    }
                }
                continue;
            }
        }

        if part.contains('\\') || part.contains('/') {
            for sub in part.split(['\\', '/']) {
                let sub = sub.trim_matches(['\"', '\'', '(', ')', ',', ';']);
                if !sub.is_empty() {
                    terms.push(sub.to_lowercase());
                }
            }
        } else {
            terms.push(part.to_lowercase());
        }
    }
    terms
}

/// Computes character ranges in `name` that match any of the query terms (case-insensitive)
pub fn find_matched_ranges(name: &str, terms: &[String]) -> Vec<[usize; 2]> {
    if terms.is_empty() || name.is_empty() {
        return Vec::new();
    }

    let name_lower = name.to_lowercase();
    let mut byte_ranges: Vec<(usize, usize)> = Vec::new();

    for term in terms {
        if term.is_empty() {
            continue;
        }
        let mut start = 0;
        while let Some(pos) = name_lower[start..].find(term.as_str()) {
            let actual_start = start + pos;
            let actual_end = actual_start + term.len();
            byte_ranges.push((actual_start, actual_end));
            start = actual_start + 1.max(term.len());
            if start >= name_lower.len() {
                break;
            }
        }
    }

    if byte_ranges.is_empty() {
        return Vec::new();
    }

    // Sort by start position
    byte_ranges.sort_by_key(|&(s, e)| (s, -(e as isize)));

    // Merge overlapping ranges
    let mut merged: Vec<[usize; 2]> = Vec::new();
    let mut cur_start = byte_ranges[0].0;
    let mut cur_end = byte_ranges[0].1;

    for &(start, end) in &byte_ranges[1..] {
        if start <= cur_end {
            cur_end = cur_end.max(end);
        } else {
            merged.push([cur_start, cur_end]);
            cur_start = start;
            cur_end = end;
        }
    }
    merged.push([cur_start, cur_end]);

    merged
}
