import { keywords, literalTypes, operators, symbols } from "./constants.ts";
import type { Token, TokenType } from "./types.ts";

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

function createToken(
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

  private mode: ("default" | "inString")[] = ["default"];

  constructor(public source: string) {
    this.sourceLength = source.length;
  }

  *tokenize(): Generator<Token, void, undefined> {
    if (this.sourceLength === 0) {
      yield createToken("EOF", "EOF", this.line, this.column);
      return;
    }

    // Skip leading whitespace and newlines
    this.skipLeadingWhitespace();

    while (this.position < this.sourceLength) {
      const currentMode = this.mode[this.mode.length - 1];
      const char = this.source[this.position];
      // Guard against undefined
      if (!char) break;

      if (currentMode === "inString") {
        if (char === '"') {
          this.mode.pop();
          this.advance(); // Consume "
          continue;
        }

        if (char === "#" && this.peekNext() === "{") {
          const startLine = this.line;
          const startColumn = this.column;
          this.advance(); // #
          this.advance(); // {
          yield createToken(
            "INTERPOLATION_START",
            "#{ ",
            startLine,
            startColumn,
          );
          this.mode.push("default");
          continue;
        }

        // It's string content. Read until the next " or #{
        const startLine = this.line;
        const startColumn = this.column;
        let content = "";
        while (
          this.peek() &&
          this.peek() !== '"' &&
          !(this.peek() === "#" && this.peekNext() === "{")
        ) {
          if (this.peek() === "\\" && this.peekNext()) {
            this.advance(); // consume '\'
            const next = this.peek()!;
            switch (next) {
              case "n":
                content += "\n";
                break;
              case "t":
                content += "\t";
                break;
              case "\\":
                content += "\\";
                break;
              case '"':
                content += '"';
                break;
              default:
                content += "\\" + next; // Keep unrecognized escapes
            }
            this.advance();
          } else if (this.isNewline(this.peek()!)) {
            const newlineChar = this.peek()!;
            content += newlineChar;
            this.advance();
            if (newlineChar === "\r" && this.peek() === "\n") {
              content += "\n";
              this.advance();
            }
            this.line++;
            this.column = 1;
          } else {
            content += this.peek()!;
            this.advance();
          }
        }
        if (content) {
          yield createToken("STRING", content, startLine, startColumn);
        }
        continue;
      }

      // currentMode === 'default'
      if (this.mode.length > 1 && char === "}") {
        // Check we are in an interpolation
        this.mode.pop();
        const startLine = this.line;
        const startColumn = this.column;
        this.advance();
        yield createToken("INTERPOLATION_END", "}", startLine, startColumn);
        continue;
      }

      switch (true) {
        case this.isNewline(char):
          yield createToken("NEWLINE", "\n", this.line, this.column);
          this.advance(); // Consume the current newline character ('\n' or '\r')
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
          this.mode.push("inString");
          this.advance(); // Consume "
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

    if (this.mode.length > 1) {
      this.error(`Unterminated string or interpolation block at end of file.`);
    }

    // Close indentation stack
    while (this.indentStack.length > 1) {
      const previousIndent = this.indentStack.pop()!;
      yield createToken("DEDENT", previousIndent, this.line, this.column);
    }

    yield createToken("EOF", "EOF", this.line, this.column);
  }

  private skipLeadingWhitespace() {
    while (this.position < this.sourceLength) {
      const char = this.peek();

      if (!char) break;

      if (this.isWhitespace(char) || this.isNewline(char)) {
        if (this.isNewline(char)) {
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

    const currentChar = spaces > 0 ? " " : tabs > 0 ? "\t" : null;
    if (this.indentChar === null && currentChar !== null) {
      this.indentChar = currentChar;
    } else if (currentChar !== null && currentChar !== this.indentChar) {
      this.error("Inconsistent indentation character");
    }

    const currentIndent = this.indentStack[this.indentStack.length - 1] ?? 0;
    if (indentLevel > currentIndent) {
      this.indentStack.push(indentLevel);
      yield createToken("INDENT", indentLevel, startLine, startColumn);
    } else if (indentLevel < currentIndent) {
      while (
        this.indentStack.length > 1 &&
        (this.indentStack[this.indentStack.length - 1] as number) > indentLevel
      ) {
        const previousIndent = this.indentStack.pop()!;
        yield createToken("DEDENT", previousIndent, startLine, startColumn);
      }

      if (this.indentStack[this.indentStack.length - 1] !== indentLevel) {
        this.error("Invalid dedentation level");
      }
    }

    this.atLineStart = false;
  }

  private *handleNumber(): Generator<Token, void, undefined> {
    const startLine = this.line;
    const startColumn = this.column;
    let numStr = this.readUntil((c) => !this.isDigit(c));

    if (this.peek() === "." && this.isDigit(this.peekNext() ?? "")) {
      this.advance();
      numStr += ".";
      numStr += this.readUntil((c) => !this.isDigit(c));
    }

    yield createToken("NUMBER", Number(numStr), startLine, startColumn);
  }

  private *handleOperatorOrSymbol(): Generator<Token, void, undefined> {
    const startLine = this.line;
    const startColumn = this.column;
    let symbol = this.peek();
    if (!symbol) return;

    this.advance();

    const nextChar = this.peek();
    if (nextChar && operators.has(symbol + nextChar)) {
      symbol += nextChar;
      this.advance();
    }

    const type = operators.get(symbol) || symbols.get(symbol);
    if (!type) {
      this.error(`Unknown operator or symbol: ${symbol}`);
    }

    yield createToken(type, symbol, startLine, startColumn);
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

    yield createToken(type, ident, startLine, startColumn);
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
