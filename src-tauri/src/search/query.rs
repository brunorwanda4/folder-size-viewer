use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::Instant;
use tantivy::collector::{Count, TopDocs};
use tantivy::query::{BooleanQuery, Occur, Query, QueryParser, TermQuery};
use tantivy::schema::{IndexRecordOption, Value};
use tantivy::snippet::SnippetGenerator;
use tantivy::{Index, Searcher, Term};

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
/// - Replaces colons in non-field terms (e.g. timestamps like "03:26:21" or Windows drive paths)
///   so Tantivy does not treat them as nonexistent schema field names.
/// - Keeps valid field specifiers like `name:`, `content:`, `ext:`, `path:`, `dir:`, `category:`.
pub fn sanitize_query(raw: &str) -> String {
    let known_fields = ["name", "content", "ext", "path", "dir", "category"];
    let mut words = Vec::new();

    for word in raw.split_whitespace() {
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
        words.push(word.to_string());
    }

    words.join(" ")
}

pub fn execute_search(
    index: &Index,
    searcher: &Searcher,
    fields: &SearchFields,
    params: SearchParams,
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
    // Name matches rank above n-gram matches, which rank above content matches
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
        if !cat.is_empty() && !cat.eq_ignore_ascii_case("all") {
            let term = Term::from_field_text(fields.category, cat);
            clauses.push((
                Occur::Must,
                Box::new(TermQuery::new(term, IndexRecordOption::Basic)),
            ));
        }
    }

    let final_query: Box<dyn Query> = if clauses.len() == 1 {
        user_query
    } else {
        Box::new(BooleanQuery::new(clauses))
    };

    // 3. Search top docs and total count
    let top_docs_collector = TopDocs::with_limit(limit)
        .and_offset(offset)
        .order_by_score();

    let (top_docs, total_count) = searcher
        .search(&*final_query, &(top_docs_collector, Count))
        .map_err(|e| format!("Search execution failed: {}", e))?;

    // Prepare snippet generator if searching contents
    let snippet_generator = if params.mode != "names" {
        SnippetGenerator::create(searcher, &*final_query, fields.content).ok()
    } else {
        None
    };

    // Query terms for filename highlighting
    let query_terms = extract_search_terms(&sanitized_query_str);

    let mut hits = Vec::with_capacity(top_docs.len());
    let max_bytes = max_content_size_mb * 1024 * 1024;

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

        // 4. On-demand snippet generation for top results (capped at first 5 to keep search instant)
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

    Ok(SearchResult {
        hits,
        total: total_count,
        took_ms: start_time.elapsed().as_millis() as u64,
    })
}

/// Extracts search terms (excluding field operators like ext:pdf or dir:) for filename highlighting
fn extract_search_terms(query: &str) -> Vec<String> {
    let mut terms = Vec::new();
    for part in query.split_whitespace() {
        let part = part.trim_matches(['"', '\'', '(', ')', ',', ';']);
        if part.is_empty() {
            continue;
        }
        // If it's a field query like name:foo or ext:pdf, extract the value
        if let Some((field, val)) = part.split_once(':') {
            if field == "ext" || field == "name" || field == "content" {
                let v = val.trim_matches(['"', '\'', '(', ')', ',', ';']);
                if !v.is_empty() {
                    terms.push(v.to_lowercase());
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
    byte_ranges.sort_by_key(|&(s, _)| s);

    // Merge overlapping ranges
    let mut merged: Vec<[usize; 2]> = Vec::new();
    let (mut curr_start, mut curr_end) = byte_ranges[0];

    for &(s, e) in &byte_ranges[1..] {
        if s < curr_end {
            curr_end = curr_end.max(e);
        } else {
            merged.push([curr_start, curr_end]);
            curr_start = s;
            curr_end = e;
        }
    }
    merged.push([curr_start, curr_end]);

    merged
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_matched_ranges() {
        let terms = vec!["app".to_string(), "data".to_string()];
        let ranges = find_matched_ranges("AppData_Local", &terms);
        assert_eq!(ranges, vec![[0, 3], [3, 7]]);
    }

    #[test]
    fn test_sanitize_query_timestamps_and_drives() {
        let q = "ChatGPT Image Sep 24, 2026, 03:26:21 AM ext:png";
        let sanitized = sanitize_query(q);
        assert_eq!(sanitized, "ChatGPT Image Sep 24, 2026, 03 26 21 AM ext:png");
    }
}
