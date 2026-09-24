use std::fs::{self, File};
use std::io::Write;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tauri::ipc::Channel;
use tempfile::tempdir;

use crate::search::indexer::{run_indexing, IndexManager};
use crate::search::query::{execute_search, SearchParams};
use crate::search::schema::path_to_facet;
use crate::search::settings::{IndexRoot, SearchSettings};
use crate::search::text_extract::decode_text_buffer;
use crate::search::tokenizers::{create_name_analyzer, create_ngram_analyzer};

#[test]
fn test_tokenizers_full() {
    // 1. Name tokenizer splitting and case/accent folding
    let mut analyzer = create_name_analyzer();
    let mut stream = analyzer.token_stream("My-Report_Final.2024 (Draft).DOCX");

    let mut tokens = Vec::new();
    while stream.advance() {
        tokens.push(stream.token().text.clone());
    }
    assert_eq!(
        tokens,
        vec!["my", "report", "final", "2024", "draft", "docx"]
    );

    // 2. Ngram tokenizer partial matching
    let mut ngram = create_ngram_analyzer().unwrap();
    let mut stream2 = ngram.token_stream("Invoice_March");
    let mut ngrams = Vec::new();
    while stream2.advance() {
        ngrams.push(stream2.token().text.clone());
    }
    assert!(ngrams.contains(&"invo".to_string()));
    assert!(ngrams.contains(&"march".to_string()));
}

#[test]
fn test_text_file_detection_and_decoding() {
    // Plain UTF-8
    let plain = "Rust and Tantivy search engine";
    assert_eq!(
        decode_text_buffer(plain.as_bytes()),
        Some(plain.to_string())
    );

    // UTF-8 with BOM
    let mut utf8_bom = vec![0xEF, 0xBB, 0xBF];
    utf8_bom.extend_from_slice(b"BOM text content");
    assert_eq!(
        decode_text_buffer(&utf8_bom),
        Some("BOM text content".to_string())
    );

    // UTF-16 LE with BOM
    let text16 = "UTF-16 Text";
    let mut utf16_le = vec![0xFF, 0xFE];
    for ch in text16.encode_utf16() {
        utf16_le.extend_from_slice(&ch.to_le_bytes());
    }
    assert_eq!(decode_text_buffer(&utf16_le), Some(text16.to_string()));

    // Binary file with NUL byte
    let binary = b"GIF89a\x00\x01\x00\x01\x80\x00\x00";
    assert_eq!(decode_text_buffer(binary), None);
}

#[test]
fn test_path_to_facet_conversion() {
    let p = std::path::Path::new(r"C:\Projects\search-engine\src\lib.rs");
    let facet = path_to_facet(p);
    assert_eq!(facet.to_string(), "/c/projects/search-engine/src/lib.rs");

    let root_facet = path_to_facet(std::path::Path::new(r"C:\Projects\search-engine"));
    assert!(root_facet.is_prefix_of(&facet));
}

#[test]
fn test_scoped_search_and_phrase_search() {
    let app_dir = tempdir().unwrap();
    let data_dir = tempdir().unwrap();

    let folder_a = data_dir.path().join("folder_a");
    let folder_b = data_dir.path().join("folder_b");
    fs::create_dir_all(&folder_a).unwrap();
    fs::create_dir_all(&folder_b).unwrap();

    // File 1 in folder_a
    let file1 = folder_a.join("invoice_alpha.txt");
    let mut f1 = File::create(&file1).unwrap();
    writeln!(
        f1,
        "The quick brown fox jumps over the lazy dog. Important hello world phrase here."
    )
    .unwrap();

    // File 2 in folder_b
    let file2 = folder_b.join("invoice_beta.txt");
    let mut f2 = File::create(&file2).unwrap();
    writeln!(f2, "Different content without phrase").unwrap();

    let manager = IndexManager::open_or_create(app_dir.path()).unwrap();

    let settings = SearchSettings {
        roots: vec![IndexRoot {
            path: data_dir.path().to_string_lossy().to_string(),
            index_content: true,
        }],
        exclusions: vec![],
        max_content_size_mb: 2,
        writer_memory_budget_mb: 30,
        content_extensions: vec!["txt".to_string()],
    };

    let on_event = Channel::new(|_| Ok(()));
    let cancel = Arc::new(AtomicBool::new(false));
    let pause = Arc::new(AtomicBool::new(false));

    let indexed = run_indexing(
        &manager,
        &settings,
        true,
        &on_event,
        cancel.clone(),
        pause.clone(),
    )
    .unwrap();
    assert!(indexed >= 2);

    let searcher = manager.reader.searcher();

    // Scoped search: search inside folder_a only
    let scoped_params = SearchParams {
        query: "invoice".to_string(),
        scope: "folder".to_string(),
        current_path: Some(folder_a.to_string_lossy().to_string()),
        mode: "names".to_string(),
        filter_type: None,
        filter_category: None,
        limit: Some(10),
        offset: Some(0),
    };

    let scoped_res = execute_search(
        &manager.index,
        &searcher,
        &manager.fields,
        scoped_params,
        &settings.content_extensions,
        settings.max_content_size_mb,
    )
    .unwrap();

    // Only invoice_alpha should match, invoice_beta is outside folder_a
    assert_eq!(scoped_res.total, 1);
    assert_eq!(scoped_res.hits[0].name, "invoice_alpha.txt");

    // Phrase search in content: "hello world"
    let phrase_params = SearchParams {
        query: "\"hello world\"".to_string(),
        scope: "computer".to_string(),
        current_path: None,
        mode: "contents".to_string(),
        filter_type: None,
        filter_category: None,
        limit: Some(10),
        offset: Some(0),
    };

    let phrase_res = execute_search(
        &manager.index,
        &searcher,
        &manager.fields,
        phrase_params,
        &settings.content_extensions,
        settings.max_content_size_mb,
    )
    .unwrap();

    assert_eq!(phrase_res.total, 1);
    assert_eq!(phrase_res.hits[0].name, "invoice_alpha.txt");
    assert!(phrase_res.hits[0].snippet.is_some());
}

#[test]
fn test_incremental_update_add_modify_delete() {
    let app_dir = tempdir().unwrap();
    let data_dir = tempdir().unwrap();

    let file_path = data_dir.path().join("document.txt");
    {
        let mut f = File::create(&file_path).unwrap();
        writeln!(f, "Initial content version 1").unwrap();
    }

    let manager = IndexManager::open_or_create(app_dir.path()).unwrap();

    let settings = SearchSettings {
        roots: vec![IndexRoot {
            path: data_dir.path().to_string_lossy().to_string(),
            index_content: true,
        }],
        exclusions: vec![],
        max_content_size_mb: 2,
        writer_memory_budget_mb: 30,
        content_extensions: vec!["txt".to_string()],
    };

    let on_event = Channel::new(|_| Ok(()));
    let cancel = Arc::new(AtomicBool::new(false));
    let pause = Arc::new(AtomicBool::new(false));

    // Initial build
    run_indexing(
        &manager,
        &settings,
        true,
        &on_event,
        cancel.clone(),
        pause.clone(),
    )
    .unwrap();

    // Verify initial search
    let searcher = manager.reader.searcher();
    let params1 = SearchParams {
        query: "document".to_string(),
        scope: "computer".to_string(),
        current_path: None,
        mode: "both".to_string(),
        filter_type: None,
        filter_category: None,
        limit: Some(10),
        offset: Some(0),
    };
    let res1 = execute_search(
        &manager.index,
        &searcher,
        &manager.fields,
        params1,
        &settings.content_extensions,
        settings.max_content_size_mb,
    )
    .unwrap();
    assert_eq!(res1.total, 1);

    // Modify file
    std::thread::sleep(std::time::Duration::from_millis(1100)); // Ensure modified timestamp changes
    {
        let mut f = File::create(&file_path).unwrap();
        writeln!(f, "Modified content with specialkeyword").unwrap();
    }

    // Add new file
    let new_file = data_dir.path().join("brand_new.txt");
    {
        let mut f = File::create(&new_file).unwrap();
        writeln!(f, "Fresh file content").unwrap();
    }

    // Run incremental update
    run_indexing(
        &manager,
        &settings,
        false,
        &on_event,
        cancel.clone(),
        pause.clone(),
    )
    .unwrap();

    let searcher2 = manager.reader.searcher();
    let kw_params = SearchParams {
        query: "specialkeyword".to_string(),
        scope: "computer".to_string(),
        current_path: None,
        mode: "contents".to_string(),
        filter_type: None,
        filter_category: None,
        limit: Some(10),
        offset: Some(0),
    };
    let kw_res = execute_search(
        &manager.index,
        &searcher2,
        &manager.fields,
        kw_params,
        &settings.content_extensions,
        settings.max_content_size_mb,
    )
    .unwrap();
    assert_eq!(kw_res.total, 1);
    assert_eq!(kw_res.hits[0].name, "document.txt");

    // Delete file
    fs::remove_file(&file_path).unwrap();

    // Run incremental update
    run_indexing(
        &manager,
        &settings,
        false,
        &on_event,
        cancel.clone(),
        pause.clone(),
    )
    .unwrap();

    let searcher3 = manager.reader.searcher();
    let doc_params = SearchParams {
        query: "document".to_string(),
        scope: "computer".to_string(),
        current_path: None,
        mode: "both".to_string(),
        filter_type: None,
        filter_category: None,
        limit: Some(10),
        offset: Some(0),
    };
    let doc_res = execute_search(
        &manager.index,
        &searcher3,
        &manager.fields,
        doc_params,
        &settings.content_extensions,
        settings.max_content_size_mb,
    )
    .unwrap();
    assert_eq!(doc_res.total, 0); // document.txt was deleted and is no longer found!

    // brand_new.txt is still found
    let brand_params = SearchParams {
        query: "brand_new".to_string(),
        scope: "computer".to_string(),
        current_path: None,
        mode: "both".to_string(),
        filter_type: None,
        filter_category: None,
        limit: Some(10),
        offset: Some(0),
    };
    let brand_res = execute_search(
        &manager.index,
        &searcher3,
        &manager.fields,
        brand_params,
        &settings.content_extensions,
        settings.max_content_size_mb,
    )
    .unwrap();
    assert_eq!(brand_res.total, 1);
}
