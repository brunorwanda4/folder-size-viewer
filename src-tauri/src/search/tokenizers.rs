use tantivy::tokenizer::{
    AsciiFoldingFilter, LowerCaser, NgramTokenizer, TextAnalyzer, Token, TokenStream, Tokenizer,
};

/// Custom tokenizer that splits on word delimiters:
/// whitespace, dots, dashes, underscores, slashes, colons, and non-alphanumeric punctuation.
/// For example, "Invoice_March-2024.pdf" yields ["Invoice", "March", "2024", "pdf"].
#[derive(Clone, Default)]
pub struct NameTokenizer;

pub struct NameTokenStream<'a> {
    text: &'a str,
    chars: std::str::CharIndices<'a>,
    token: Token,
    pos: usize,
}

#[inline]
fn is_name_delim(ch: char) -> bool {
    ch.is_whitespace()
        || ch == '.'
        || ch == '-'
        || ch == '_'
        || ch == '/'
        || ch == '\\'
        || ch == ':'
        || ch == ';'
        || ch == ','
        || ch == '('
        || ch == ')'
        || ch == '['
        || ch == ']'
        || ch == '{'
        || ch == '}'
        || ch == '@'
        || ch == '#'
        || ch == '!'
        || ch == '+'
        || ch == '='
        || ch == '~'
        || ch == '`'
        || ch == '\''
        || ch == '"'
}

impl<'a> TokenStream for NameTokenStream<'a> {
    fn advance(&mut self) -> bool {
        // Skip leading delimiters
        let mut start = None;
        while let Some((idx, ch)) = self.chars.next() {
            if !is_name_delim(ch) {
                start = Some(idx);
                break;
            }
        }

        let start_idx = match start {
            Some(i) => i,
            None => return false,
        };

        // Find end of token
        let mut end_idx = self.text.len();
        for (idx, ch) in self.chars.by_ref() {
            if is_name_delim(ch) {
                end_idx = idx;
                break;
            }
        }

        let token_text = &self.text[start_idx..end_idx];
        self.token.text.clear();
        self.token.text.push_str(token_text);
        self.token.offset_from = start_idx;
        self.token.offset_to = end_idx;
        self.token.position = self.pos;
        self.pos += 1;
        true
    }

    fn token(&self) -> &Token {
        &self.token
    }

    fn token_mut(&mut self) -> &mut Token {
        &mut self.token
    }
}

impl Tokenizer for NameTokenizer {
    type TokenStream<'a> = NameTokenStream<'a>;
    fn token_stream<'a>(&'a mut self, text: &'a str) -> Self::TokenStream<'a> {
        NameTokenStream {
            text,
            chars: text.char_indices(),
            token: Token::default(),
            pos: 0,
        }
    }
}

/// Tokenizer analyzer for standard word tokens:
/// Splits on delimiters, lowercases, and folds ASCII diacritics/accents.
pub fn create_name_analyzer() -> TextAnalyzer {
    TextAnalyzer::builder(NameTokenizer)
        .filter(LowerCaser)
        .filter(AsciiFoldingFilter)
        .build()
}

/// N-gram tokenizer for partial as-you-type search.
///
/// Trade-off explanation:
/// - min_gram = 2: Allows users to search for short acronyms, extensions, and prefixes
///   (e.g., "ui", "ts", "rs", "db", "ai") without generating unhelpful 1-character tokens.
/// - max_gram = 8: Caps the token volume to keep the index compact while covering typical
///   stems and query prefixes ("download", "settings", "invoice"). Queries longer than 8 chars
///   are split or matched via full-token `name` matching.
/// - prefix_only = false: Enables finding substrings anywhere inside compound or camelCase words,
///   so typing "invo" will match both "Invoice_March.pdf" and "myinvoice.txt".
pub fn create_ngram_analyzer() -> tantivy::Result<TextAnalyzer> {
    let ngram = NgramTokenizer::new(2, 8, false)
        .map_err(|e| tantivy::TantivyError::InvalidArgument(e.to_string()))?;
    Ok(TextAnalyzer::builder(ngram)
        .filter(LowerCaser)
        .filter(AsciiFoldingFilter)
        .build())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_name_tokenizer_splitting_and_folding() {
        let mut analyzer = create_name_analyzer();
        let mut stream = analyzer.token_stream("Invoice_March-2024.pdf");

        let mut tokens = Vec::new();
        while stream.advance() {
            tokens.push(stream.token().text.clone());
        }

        assert_eq!(tokens, vec!["invoice", "march", "2024", "pdf"]);
    }

    #[test]
    fn test_name_tokenizer_diacritics_folding() {
        let mut analyzer = create_name_analyzer();
        let mut stream = analyzer.token_stream("café_résumé.txt");

        let mut tokens = Vec::new();
        while stream.advance() {
            tokens.push(stream.token().text.clone());
        }

        assert_eq!(tokens, vec!["cafe", "resume", "txt"]);
    }

    #[test]
    fn test_ngram_tokenizer_partial_match() {
        let mut analyzer = create_ngram_analyzer().unwrap();
        let mut stream = analyzer.token_stream("myinvoice");

        let mut tokens = Vec::new();
        while stream.advance() {
            tokens.push(stream.token().text.clone());
        }

        // Must include "invo" substring
        assert!(tokens.contains(&"invo".to_string()));
        assert!(tokens.contains(&"my".to_string()));
    }
}
