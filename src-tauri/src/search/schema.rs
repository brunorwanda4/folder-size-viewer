use std::path::Path;
use tantivy::schema::{
    Facet, FacetOptions, Field, IndexRecordOption, Schema, SchemaBuilder, TextFieldIndexing,
    TextOptions, FAST, INDEXED, STORED, STRING,
};

pub const NAME_ANALYZER: &str = "name_analyzer";
pub const NAME_NGRAM_ANALYZER: &str = "name_ngram_analyzer";

#[derive(Clone, Copy)]
pub struct SearchFields {
    pub name: Field,
    pub name_ngram: Field,
    pub content: Field,
    pub path: Field,
    pub dir: Field,
    pub ext: Field,
    pub category: Field,
    pub is_dir: Field,
    pub size: Field,
    pub modified: Field,
}

pub fn build_schema() -> (Schema, SearchFields) {
    let mut builder = SchemaBuilder::new();

    // 1. Name: indexed with word-splitting, lowercasing, diacritic-folding tokenizer; stored
    let name_indexing = TextFieldIndexing::default()
        .set_tokenizer(NAME_ANALYZER)
        .set_index_option(IndexRecordOption::WithFreqsAndPositions);
    let name_options = TextOptions::default()
        .set_indexing_options(name_indexing)
        .set_stored();
    let name = builder.add_text_field("name", name_options);

    // 2. Name n-gram: indexed with 2..8 n-grams for as-you-type substring search; NOT stored
    let name_ngram_indexing = TextFieldIndexing::default()
        .set_tokenizer(NAME_NGRAM_ANALYZER)
        .set_index_option(IndexRecordOption::WithFreqsAndPositions);
    let name_ngram_options = TextOptions::default().set_indexing_options(name_ngram_indexing);
    let name_ngram = builder.add_text_field("name_ngram", name_ngram_options);

    // 3. Content: full text with positions for phrase searches ("hello world"); NOT stored to keep index lean
    let content_indexing = TextFieldIndexing::default()
        .set_tokenizer("default")
        .set_index_option(IndexRecordOption::WithFreqsAndPositions);
    let content_options = TextOptions::default().set_indexing_options(content_indexing);
    let content = builder.add_text_field("content", content_options);

    // 4. Path: exact string key, stored, used for document lookups, deletes, and displays
    let path = builder.add_text_field("path", STRING | STORED);

    // 5. Dir: hierarchical Facet field for parent directory
    // Facets automatically index all parent ancestors (/c/users/foo -> /c, /c/users, /c/users/foo).
    // Scoping to a folder is a single TermQuery on the folder's facet, matching every descendant instantly.
    let dir = builder.add_facet_field("dir", FacetOptions::default());

    // 6. Ext: fast field for category/extension filtering and display
    let ext = builder.add_text_field("ext", STRING | FAST | STORED);

    // 7. Category: fast field for category filtering and display
    let category = builder.add_text_field("category", STRING | FAST | STORED);

    // 8. IsDir: boolean fast field + indexed for files vs folders filtering
    let is_dir = builder.add_bool_field("is_dir", FAST | STORED | INDEXED);

    // 9. Size: u64 fast field + stored
    let size = builder.add_u64_field("size", FAST | STORED);

    // 10. Modified: date fast field + stored
    let modified = builder.add_date_field("modified", FAST | STORED);

    let schema = builder.build();

    let fields = SearchFields {
        name,
        name_ngram,
        content,
        path,
        dir,
        ext,
        category,
        is_dir,
        size,
        modified,
    };

    (schema, fields)
}

/// Converts a file or folder path into a Tantivy hierarchical Facet.
///
/// Why Tantivy Facet for folder hierarchies:
/// - Windows paths like "C:\Users\John\Documents" are split into normalized components ["c", "users", "john", "documents"].
/// - Tantivy indexes every prefix of the facet (/c, /c/users, /c/users/john, /c/users/john/documents).
/// - A TermQuery on a parent facet `/c/users/john` matches the folder and ALL of its nested descendants
///   in a single, O(1) term lookup, avoiding costly recursive path string prefix or regex scans.
pub fn path_to_facet(path: &Path) -> Facet {
    let mut components = Vec::new();

    for comp in path.components() {
        match comp {
            std::path::Component::Prefix(prefix) => {
                let s = prefix.as_os_str().to_string_lossy().to_lowercase();
                let clean = s.trim_end_matches([':', '\\', '/']).to_string();
                if !clean.is_empty() {
                    components.push(clean);
                }
            }
            std::path::Component::RootDir => {
                // Handled by prefix or root
            }
            std::path::Component::Normal(p) => {
                let s = p.to_string_lossy().to_lowercase();
                if !s.is_empty() {
                    components.push(s);
                }
            }
            _ => {}
        }
    }

    if components.is_empty() {
        Facet::root()
    } else {
        Facet::from_path(components.into_iter())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_path_to_facet_windows() {
        let p = Path::new(r"C:\Users\rbhap\Documents\Work");
        let facet = path_to_facet(p);
        assert_eq!(facet.to_string(), "/c/users/rbhap/documents/work");
    }

    #[test]
    fn test_path_to_facet_drive_root() {
        let p = Path::new(r"C:\");
        let facet = path_to_facet(p);
        assert_eq!(facet.to_string(), "/c");
    }

    #[test]
    fn test_path_to_facet_parent_prefix_match() {
        let parent = path_to_facet(Path::new(r"C:\Users\rbhap"));
        let child = path_to_facet(Path::new(r"C:\Users\rbhap\Projects\repo\file.txt"));
        assert!(parent.is_prefix_of(&child));
    }
}
