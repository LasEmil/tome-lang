import { keywords, literalTypes, operators, symbols } from "./constants.ts";
import type { TokenType } from "./types.ts";

type LiteralType = typeof literalTypes extends Set<infer U> ? U : never;

type Keyword = typeof keywords extends Set<infer U> ? U : never;

// Pre-calculate the set of starting characters for operators for O(1) lookups.
const operatorStartChars = new Set<string>();
for (const op of operators.keys()) {
  operatorStartChars.add(op[0]!);
}

class LexerError extends Error {
  constructor(
    message: string,
    public line: number,
    public column: number,
    public source?: string,
  ) {
    super(`${message} at line ${line}, column ${column}`);
    this.name = "LexerError";
  }
}

interface Token {
  type: TokenType;
  value: string | number;
  line: number;
  column: number;
}
function newToken(
  type: TokenType,
  value: string | number,
  line: number,
  column: number,
): Token {
  return { type, value, line, column };
}

export class Lexer {
  position: number = 0;
  line: number = 1;
  column: number = 1;

  sourceLength: number;

  indentStack: number[] = [0];
  indentChar: " " | "\t" | null = null;
  atLineStart: boolean = true;

  constructor(public source: string) {
    this.sourceLength = source.length;
  }

  *tokenize(): Generator<Token, void, undefined> {
    if (this.sourceLength === 0) {
      yield newToken("EOF", "EOF", this.line, this.column);
      return;
    }

    // Skip leading whitespace and newlines
    this.skipLeadingWhitespace();

    while (this.position < this.sourceLength) {
      const char = this.source[this.position];
      // Guard against undefined
      if (!char) break;

      switch (true) {
        case this.isNewline(char):
          yield newToken("NEWLINE", "\n", this.line, this.column);
          this.advance(); // Consume the current newline character ('\n' or '\r')
          // If it was a carriage return, check if it's followed by a line feed (\r\n)
          if (char === "\r" && this.peek() === "\n") {
            this.advance(); // Consume the line feed as part of the same newline
          }
          this.line++;
          this.column = 1;
          this.atLineStart = true;
          break;

        case this.atLineStart:
          yield* this.handleIndent();
          break;

        case this.isWhitespace(char):
          this.advance();
          break;

        case char === "#":
          this.skipUntilEndOfLine();
          break;

        case char === '"':
          yield* this.handleString();
          break;

        case this.isDigit(char):
          yield* this.handleNumber();
          break;

        case this.isOperatorStart(char) || this.isSymbol(char):
          yield* this.handleOperatorOrSymbol();
          break;

        case this.isLetter(char):
          yield* this.handleIdentifier();
          break;

        default:
          this.error(`Unexpected character: ${char}`);
      }
    }

    // Close indentation stack
    while (this.indentStack.length > 1) {
      const previousIndent = this.indentStack.pop()!;
      yield newToken("DEDENT", previousIndent, this.line, this.column);
    }

    yield newToken("EOF", "EOF", this.line, this.column);
  }

  private skipLeadingWhitespace() {
    while (this.position < this.sourceLength) {
      const char = this.peek();

      // Guard against undefined
      if (!char) break;

      if (this.isWhitespace(char) || this.isNewline(char)) {
        if (this.isNewline(char)) {
          // Handle \r\n
          if (char === "\r" && this.peekNext() === "\n") {
            this.advance();
          }
          this.line++;
          this.column = 1;
        }
        this.advance();
      } else {
        break;
      }
    }
  }

  private *handleIndent(): Generator<Token, void, undefined> {
    let indentLevel = 0;
    let spaces = 0;
    let tabs = 0;
    const startLine = this.line;
    const startColumn = this.column;

    while (this.peek() && this.isWhitespace(this.peek()!)) {
      if (this.peek() === " ") spaces++;
      if (this.peek() === "\t") tabs++;
      indentLevel++;
      this.advance();
    }

    if (spaces > 0 && tabs > 0) {
      this.error("Mixed indentation (spaces + tabs) detected");
    }

    // Validate consistent indentation character
    const currentChar = spaces > 0 ? " " : tabs > 0 ? "\t" : null;
    if (this.indentChar === null && currentChar !== null) {
      this.indentChar = currentChar;
    } else if (currentChar !== null && currentChar !== this.indentChar) {
      this.error("Inconsistent indentation character");
    }

    const currentIndent = this.indentStack[this.indentStack.length - 1] ?? 0;
    if (indentLevel > currentIndent) {
      this.indentStack.push(indentLevel);
      yield newToken("INDENT", indentLevel, startLine, startColumn);
    } else if (indentLevel < currentIndent) {
      while (
        this.indentStack.length > 1 &&
        (this.indentStack[this.indentStack.length - 1] as number) > indentLevel
      ) {
        const previousIndent = this.indentStack.pop()!;
        yield newToken("DEDENT", previousIndent, startLine, startColumn);
      }

      // Validate that we landed on a valid indentation level
      if (this.indentStack[this.indentStack.length - 1] !== indentLevel) {
        this.error("Invalid dedentation level");
      }
    }

    this.atLineStart = false;
  }

  private *handleString(): Generator<Token, void, undefined> {
    const startLine = this.line;
    const startColumn = this.column;
    this.advance(); // skip opening quote

    let str = "";
    while (this.position < this.sourceLength) {
      const char = this.peek();
      // Guard against undefined
      if (!char) break;

      if (char === '"') {
        this.advance(); // skip closing quote
        yield newToken("STRING", str, startLine, startColumn);
        return;
      }

      // If we see a newline, increment the line count and reset the column.
      if (this.isNewline(char)) {
        str += char;
        if (char === "\r" && this.peekNext() === "\n") {
          str += "\n";
          this.advance();
        }
        this.advance();
        this.line++;
        this.column = 1;
        continue; // Continue to the next character
      }

      // Handle escape sequences
      if (char === "\\" && this.peekNext()) {
        const next = this.peekNext()!;
        switch (next) {
          case "n":
            str += "\n";
            this.advance();
            break;
          case "t":
            str += "\t";
            this.advance();
            break;
          case "\\":
            str += "\\";
            this.advance();
            break;
          case '"':
            str += '"';
            this.advance();
            break;
          default:
            str += char;
        }
      } else {
        str += char;
      }

      this.advance();
    }

    this.error("Unterminated string literal");
  }

  private *handleNumber(): Generator<Token, void, undefined> {
    const startLine = this.line;
    const startColumn = this.column;
    let numStr = this.readUntil((c) => !this.isDigit(c));

    // Check for a fractional part
    if (this.peek() === "." && this.isDigit(this.peekNext() ?? "")) {
      this.advance(); // Consume '.'
      numStr += ".";
      numStr += this.readUntil((c) => !this.isDigit(c));
    }

    yield newToken("NUMBER", Number(numStr), startLine, startColumn);
  }

  private *handleOperatorOrSymbol(): Generator<Token, void, undefined> {
    const startLine = this.line;
    const startColumn = this.column;
    let symbol = this.peek();
    if (!symbol) return;

    this.advance(); // Consume first char of potential operator

    // Check for two-character operators
    const nextChar = this.peek();
    if (nextChar && operators.has(symbol + nextChar)) {
      symbol += nextChar;
      this.advance();
    }

    const type = operators.get(symbol) || symbols.get(symbol);
    if (!type) {
      this.error(`Unknown operator or symbol: ${symbol}`);
    }

    yield newToken(type, symbol, startLine, startColumn);
  }

  private *handleIdentifier(): Generator<Token, void, undefined> {
    const startLine = this.line;
    const startColumn = this.column;
    const ident = this.readUntil((c) => !this.isAlphanumeric(c));

    const type: TokenType = keywords.has(ident as Keyword)
      ? (ident.toUpperCase() as TokenType)
      : literalTypes.has(ident as LiteralType)
        ? (ident.toUpperCase() as TokenType)
        : "IDENTIFIER";

    yield newToken(type, ident, startLine, startColumn);
  }

  private error(message: string): never {
    throw new LexerError(message, this.line, this.column, this.source);
  }

  private advance() {
    this.position++;
    this.column++;
  }

  private peek(): string | undefined {
    if (this.position >= this.sourceLength) return undefined;
    return this.source[this.position];
  }

  private peekNext(): string | undefined {
    if (this.position + 1 >= this.sourceLength) return undefined;
    return this.source[this.position + 1];
  }

  private skipUntilEndOfLine() {
    while (this.peek() && !this.isNewline(this.peek()!)) {
      this.advance();
    }
  }

  private readUntil(predicate: (char: string) => boolean): string {
    let result = "";
    while (this.peek() && !predicate(this.peek()!)) {
      result += this.peek()!;
      this.advance();
    }
    return result;
  }

  private isWhitespace(char: string): boolean {
    return char === " " || char === "\t";
  }

  private isNewline(char: string): boolean {
    return char === "\n" || char === "\r";
  }

  private isDigit(char: string): boolean {
    return char >= "0" && char <= "9";
  }

  private isSymbol(char: string): boolean {
    return symbols.has(char);
  }

  private isOperatorStart(char: string): boolean {
    return operatorStartChars.has(char);
  }

  private isLetter(char: string): boolean {
    return (
      (char >= "a" && char <= "z") ||
      (char >= "A" && char <= "Z") ||
      char === "_"
    );
  }

  private isAlphanumeric(char: string): boolean {
    return this.isLetter(char) || this.isDigit(char);
  }
}
