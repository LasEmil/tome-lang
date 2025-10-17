export type TokenType =
  // Keywords
  | "NODE"
  | "SAY"
  | "CHOICE"
  | "GOTO"
  | "IF"
  | "END"
  | "RANDOM"

  // Identifiers and Literals
  | "IDENTIFIER" // variable names, node names
  | "NUMBER" // 123, 45.6
  | "STRING" // "hello world"
  | "TRUE" // true
  | "FALSE" // false

  // Symbols
  | "AT_SIGN" // @
  | "COLON" // :
  | "COMMA" // ,
  | "LEFT_PAREN" // (
  | "RIGHT_PAREN" // )

  // Operators
  | "EQUALS" // =
  | "PLUS_EQUALS" // +=
  | "MINUS_EQUALS" // -=
  | "STAR_EQUALS" // *=
  | "SLASH_EQUALS" // /=

  // Comparison
  | "EQUALS_EQUALS" // ==
  | "NOT_EQUALS" // !=
  | "GREATER" // >
  | "GREATER_EQUALS" // >=
  | "LESS" //
  | "LESS_EQUALS" // <=

  // Logical
  | "AND" // &&
  | "OR" // ||
  | "NOT" // !

  // Arithmetic (for expressions)
  | "PLUS" // +
  | "MINUS" // -
  | "STAR" // *
  | "SLASH" // /

  // Whitespace/Structure
  | "NEWLINE" // \n
  | "INDENT" // increased indentation
  | "DEDENT" // decreased indentation
  | "EOF" // end of file

  // Comments
  | "COMMENT"; // # comment
