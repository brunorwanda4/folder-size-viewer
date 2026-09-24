use std::fs::File;
use std::io::Read;
use std::path::Path;

/// Maximum bytes to inspect for the binary NUL-byte sniffer
const SNIFF_SIZE: usize = 8192;

/// Checks if an extension is in the allowlist for text extraction
pub fn is_text_extension(ext: &str, allowlist: &[String]) -> bool {
    let clean = ext.trim_start_matches('.').to_lowercase();
    allowlist
        .iter()
        .any(|item| item.eq_ignore_ascii_case(&clean))
}

/// Reads file content if it passes extension allowlist, size limits, and binary sniff.
/// Returns decoded text, or None if the file is binary, oversized, or unreadable.
pub fn extract_text_content(path: &Path, max_bytes: u64, allowlist: &[String]) -> Option<String> {
    // 1. Check extension allowlist
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
    if !is_text_extension(ext, allowlist) {
        return None;
    }

    // 2. Check file size
    let metadata = std::fs::metadata(path).ok()?;
    if !metadata.is_file() || metadata.len() > max_bytes || metadata.len() == 0 {
        return None;
    }

    // 3. Open file and read content
    let mut file = File::open(path).ok()?;
    let mut buffer = Vec::new();
    // Read up to max_bytes + 1 to prevent reading unbounded data
    let mut handle = (&mut file).take(max_bytes + 1);
    handle.read_to_end(&mut buffer).ok()?;

    if buffer.len() as u64 > max_bytes {
        return None;
    }

    decode_text_buffer(&buffer)
}

/// Decodes a byte buffer into a String, handling UTF-16 BOM, UTF-8 BOM, and NUL-byte sniffing.
pub fn decode_text_buffer(buffer: &[u8]) -> Option<String> {
    if buffer.is_empty() {
        return Some(String::new());
    }

    // Check UTF-16 LE BOM: [0xFF, 0xFE]
    if buffer.len() >= 2 && buffer[0] == 0xFF && buffer[1] == 0xFE {
        let u16_slice: Vec<u16> = buffer[2..]
            .chunks_exact(2)
            .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
            .collect();
        return Some(String::from_utf16_lossy(&u16_slice));
    }

    // Check UTF-16 BE BOM: [0xFE, 0xFF]
    if buffer.len() >= 2 && buffer[0] == 0xFE && buffer[1] == 0xFF {
        let u16_slice: Vec<u16> = buffer[2..]
            .chunks_exact(2)
            .map(|chunk| u16::from_be_bytes([chunk[0], chunk[1]]))
            .collect();
        return Some(String::from_utf16_lossy(&u16_slice));
    }

    // Check UTF-8 BOM: [0xEF, 0xBB, 0xBF]
    let bytes_to_sniff =
        if buffer.len() >= 3 && buffer[0] == 0xEF && buffer[1] == 0xBB && buffer[2] == 0xBF {
            &buffer[3..]
        } else {
            buffer
        };

    // Sniff first 8KB for NUL bytes to detect binary files
    let sniff_len = bytes_to_sniff.len().min(SNIFF_SIZE);
    if bytes_to_sniff[..sniff_len].iter().any(|&b| b == 0) {
        return None;
    }

    Some(String::from_utf8_lossy(bytes_to_sniff).into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_plain_utf8_text() {
        let text = "Hello world! This is a valid UTF-8 text document.";
        let res = decode_text_buffer(text.as_bytes());
        assert_eq!(res, Some(text.to_string()));
    }

    #[test]
    fn test_utf8_bom() {
        let mut buf = vec![0xEF, 0xBB, 0xBF];
        buf.extend_from_slice(b"BOM content");
        let res = decode_text_buffer(&buf);
        assert_eq!(res, Some("BOM content".to_string()));
    }

    #[test]
    fn test_utf16_le_bom() {
        let original = "Hello UTF-16 LE";
        let mut buf = vec![0xFF, 0xFE];
        for ch in original.encode_utf16() {
            buf.extend_from_slice(&ch.to_le_bytes());
        }
        let res = decode_text_buffer(&buf);
        assert_eq!(res, Some(original.to_string()));
    }

    #[test]
    fn test_binary_nul_byte_sniff() {
        let mut buf = b"Some initial text ".to_vec();
        buf.push(0x00);
        buf.extend_from_slice(b"rest of binary data");
        let res = decode_text_buffer(&buf);
        assert_eq!(res, None);
    }

    #[test]
    fn test_extract_text_content_file() {
        let mut file = NamedTempFile::with_suffix(".txt").unwrap();
        writeln!(file, "Function test_something() in a file.").unwrap();
        let path = file.path();

        let allowlist = vec!["txt".to_string(), "rs".to_string()];
        let extracted = extract_text_content(path, 1024 * 1024, &allowlist);
        assert!(extracted.is_some());
        assert!(extracted.unwrap().contains("Function test_something()"));
    }

    #[test]
    fn test_extract_text_unsupported_ext() {
        let mut file = NamedTempFile::with_suffix(".exe").unwrap();
        writeln!(file, "dummy content").unwrap();
        let path = file.path();

        let allowlist = vec!["txt".to_string(), "rs".to_string()];
        let extracted = extract_text_content(path, 1024 * 1024, &allowlist);
        assert_eq!(extracted, None);
    }
}
