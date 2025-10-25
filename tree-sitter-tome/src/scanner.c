#include <tree_sitter/parser.h>
#include <wctype.h>

enum TokenType {
  STRING_CONTENT,
  INTERPOLATION_START,
  INTERPOLATION_END,
};

void *tree_sitter_tome_external_scanner_create() { return NULL; }

void tree_sitter_tome_external_scanner_destroy(void *p) {}

unsigned tree_sitter_tome_external_scanner_serialize(void *p, char *b) { 
  return 0; 
}

void tree_sitter_tome_external_scanner_deserialize(void *p, const char *b, unsigned n) {}

bool tree_sitter_tome_external_scanner_scan(void *payload, TSLexer *lexer,
                                            const bool *valid_symbols) {
  // Handle interpolation start: #{
  if (valid_symbols[INTERPOLATION_START] && lexer->lookahead == '#') {
    lexer->advance(lexer, false);
    if (lexer->lookahead == '{') {
      lexer->advance(lexer, false);
      lexer->result_symbol = INTERPOLATION_START;
      return true;
    }
    return false;
  }

  // Handle interpolation end: }
  if (valid_symbols[INTERPOLATION_END] && lexer->lookahead == '}') {
    lexer->advance(lexer, false);
    lexer->result_symbol = INTERPOLATION_END;
    return true;
  }

  // Handle string content
  if (valid_symbols[STRING_CONTENT]) {
    bool has_content = false;
    
    for (;;) {
      // Stop at: double quote (end of string), backslash (escape), or EOF
      // REMOVED: single quote check - allow apostrophes in strings!
      if (lexer->lookahead == '"' || lexer->lookahead == '\\' || lexer->eof(lexer)) {
        break;
      }

      // Check for interpolation start: #{
      if (lexer->lookahead == '#') {
        lexer->mark_end(lexer);
        lexer->advance(lexer, false);
        if (lexer->lookahead == '{') {
          // Found interpolation, return what we have so far
          lexer->result_symbol = STRING_CONTENT;
          return has_content;
        }
        // Just a regular # character, continue
        has_content = true;
        continue;
      }

      // Regular character, consume it
      has_content = true;
      lexer->advance(lexer, false);
    }

    lexer->mark_end(lexer);
    lexer->result_symbol = STRING_CONTENT;
    return has_content;
  }

  return false;
}
