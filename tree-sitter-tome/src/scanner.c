#include <tree_sitter/parser.h>
#include <wctype.h>

enum TokenType {
  STRING_CONTENT,
  INTERPOLATION_START,
  INTERPOLATION_END,
};

void *tree_sitter_tome_external_scanner_create() { return NULL; }
void tree_sitter_tome_external_scanner_destroy(void *p) {}
unsigned tree_sitter_tome_external_scanner_serialize(void *p, char *b) { return 0; }
void tree_sitter_tome_external_scanner_deserialize(void *p, const char *b, unsigned n) {}

bool tree_sitter_tome_external_scanner_scan(void *payload, TSLexer *lexer,
                                            const bool *valid_symbols) {
  // The external scanner is only responsible for tokens within a string.
  // It is not active outside of a string.

  if (valid_symbols[INTERPOLATION_START] && lexer->lookahead == '#') {
    lexer->advance(lexer, false);
    if (lexer->lookahead == '{') {
      lexer->advance(lexer, false);
      lexer->result_symbol = INTERPOLATION_START;
      return true;
    }
    return false;
  }

  if (valid_symbols[INTERPOLATION_END] && lexer->lookahead == '}') {
    lexer->advance(lexer, false);
    lexer->result_symbol = INTERPOLATION_END;
    return true;
  }

  if (valid_symbols[STRING_CONTENT]) {
    bool has_content = false;
    for (;;) {
      if (lexer->lookahead == '\'' || lexer->lookahead == '"' || lexer->eof(lexer)) {
        break;
      }
      if (lexer->lookahead == '#') {
        lexer->mark_end(lexer);
        lexer->advance(lexer, false);
        if (lexer->lookahead == '{') {
          lexer->mark_end(lexer);
          lexer->result_symbol = STRING_CONTENT;
          return has_content;
        }
        continue;
      }
      has_content = true;
      lexer->advance(lexer, false);
    }
    lexer->mark_end(lexer);
    lexer->result_symbol = STRING_CONTENT;
    return has_content;
  }

  return false;
}
