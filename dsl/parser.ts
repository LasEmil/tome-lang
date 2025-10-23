import type {
  AssignmentOperator,
  AssignmentStatement,
  AST,
  ChoiceStatement,
  DialogueNode,
  Expression,
  GotoStatement,
  Interpolation,
  NodeNetwork,
  ParseResult,
  SayStatement,
  Statement,
  Token,
  TokenType,
} from "./types.ts";

export class ParserError extends Error {
  constructor(
    message: string,
    public line: number,
    public column: number,
    public sourceLine?: string,
  ) {
    const location = `line ${line}, column ${column}`;
    let fullMessage = `Parse Error at ${location}: ${message}`;

    if (sourceLine) {
      const trimmedLine = sourceLine.trimStart();
      const indentLength = sourceLine.length - trimmedLine.length;
      const adjustedColumn = Math.max(1, column - indentLength);
      fullMessage += `\n\n  ${trimmedLine}\n  ${" ".repeat(adjustedColumn - 1)}^\n`;
    }

    super(fullMessage);
    this.name = "ParserError";
  }
}

export class AggregateParserError extends Error {
  constructor(public errors: ParserError[]) {
    super(`Found ${errors.length} parse error${errors.length > 1 ? "s" : ""}`);
    this.name = "AggregateParserError";
  }
}


export class Parser {
  private lexer: Iterator<Token>;
  private currentToken: Token;
  private nextToken: Token | null;
  private previousToken: Token | null = null;
  private sourceLines: string[];
  private errors: ParserError[] = [];

  constructor(lexerGenerator: ArrayIterator<Token>, source?: string) {
    this.lexer = lexerGenerator;
    this.sourceLines = source ? source.split("\n") : [];

    // Prime the pump with first two tokens
    this.currentToken = this.pullToken();
    this.nextToken = this.pullToken();
  }

  private pullToken(): Token {
    const result = this.lexer.next();
    return result.done
      ? { type: "EOF", value: "EOF", line: 0, column: 0 }
      : result.value;
  }

  public parse(): ParseResult {
    const nodes: DialogueNode[] = [];

    while (!this.isAtEnd()) {
      try {
        this.skipNewlines();

        if (this.isAtEnd()) {
          break;
        }

        const node = this.parseNode();
        nodes.push(node);
      } catch (e) {
        if (e instanceof ParserError) {
          this.errors.push(e);
          this.synchronize();
        } else {
          throw e;
        }
      }
    }

    const valid = this.errors.length === 0;
    return {
      value: valid ? { type: "Program", nodes } : null,
      errors: this.errors,
      valid,
    };
  }

  // Generator version for streaming node processing
  *parseNodesStreaming(): Generator<DialogueNode, void, unknown> {
    while (!this.isAtEnd()) {
      try {
        this.skipNewlines();

        if (this.isAtEnd()) {
          break;
        }

        yield this.parseNode();
      } catch (e) {
        if (e instanceof ParserError) {
          this.errors.push(e);
          this.synchronize();
        } else {
          throw e;
        }
      }
    }
  }

  static getNodeNetwork(ast: AST): NodeNetwork{
    const nodes = new Set<string>();
    const links: {source: string, target: string}[] = [];

    for(const node of ast.nodes){
      nodes.add(node.id);
      for(const stmt of node.statements){
        if(stmt.type === "Choice" || stmt.type === "Goto"){
          links.push({source: node.id, target: stmt.target});
        }
      }
    }

    return {nodes, links};
  }

  private synchronize(): void {
    // Skip tokens until we find a safe point to resume (next node or EOF)
    while (!this.isAtEnd()) {
      if (this.peek().type === "NODE") {
        return;
      }
      this.advance();
    }
  }

  private parseNode(): DialogueNode {
    this.consume("NODE", "Expected 'node' keyword at the beginning of a node");
    const nodeName = this.consume("IDENTIFIER", "Expected node identifier");
    this.consume("NEWLINE", "Expected newline after node declaration");

    const statements: Statement[] = [];

    // If we find an indented block, parse its contents.
    if (this.match(["INDENT"])) {
      while (!this.expect("DEDENT") && !this.expect("END")) {
        this.skipNewlines();

        if (this.expect("DEDENT") || this.expect("END")) {
          break;
        }

        try {
          statements.push(this.parseStatement());
        } catch (e) {
          if (e instanceof ParserError) {
            this.errors.push(e);
            // Skip to next statement (next line)
            while (!this.isAtEnd() && this.peek().type !== "NEWLINE") {
              this.advance();
            }
            if (this.peek().type === "NEWLINE") {
              this.advance();
            }
          } else {
            throw e;
          }
        }
      }

      // A DEDENT should follow the statements.
      if (this.peek().type === "DEDENT") {
        this.advance();
      }
    }
    // If there was no INDENT, we just skip to consuming END,
    // correctly creating a node with an empty statements array.

    this.consume("END", "Expected 'end' keyword to close node");

    return {
      type: "Node",
      id: nodeName.value as string,
      statements,
      line: nodeName.line,
      column: nodeName.column,
    };
  }

  private parseStatement(): Statement {
    const token = this.peek();
    switch (token.type) {
      case "AT_SIGN":
        return this.parseAssignment();
      case "SAY":
        return this.parseSay();
      case "CHOICE":
        return this.parseChoice();
      case "GOTO":
        return this.parseGoto();
      default: {
        const expected = ["@variable (assignment)", "say", "choice", "goto"];
        this.error(
          `Unexpected token '${token.value}'. Expected one of: ${expected.join(", ")}`,
          token,
        );
      }
    }
  }

  private parseAssignment(): AssignmentStatement {
    this.consume("AT_SIGN", "Expected '@' at the beginning of variable");
    const variable = this.consume("IDENTIFIER", "Expected variable name");
    const operatorToken = this.advance();

    // Validate it's actually an assignment operator
    const validOps = ["=", "+=", "-=", "*=", "/="];
    if (!validOps.includes(operatorToken.value as string)) {
      this.error(
        `Invalid assignment operator '${operatorToken.value}'. Expected one of: ${validOps.join(", ")}`,
        operatorToken,
      );
    }

    const value = this.parseExpression();
    this.consume("NEWLINE", "Expected newline after assignment statement");

    return {
      type: "Assignment",
      variable: variable.value as string,
      operator: operatorToken.value as AssignmentOperator,
      value,
      line: variable.line,
      column: variable.column,
    };
  }

  private parseSay(): SayStatement {
    const sayToken = this.consume("SAY", "Expected 'say' keyword");

    let fullText = "";
    const interpolations: Interpolation[] = [];

    // Keep consuming STRING and INTERPOLATION tokens until we hit NEWLINE
    while (this.match(["STRING", "INTERPOLATION_START"])) {
      const token = this.getPreviousToken();

      if (token.type === "STRING") {
        fullText += token.value as string;
      } else if (token.type === "INTERPOLATION_START") {
        const startPos = fullText.length;
        const expression = this.parseExpression();

        this.consume(
          "INTERPOLATION_END",
          "Expected '}' to close interpolation",
        );

        interpolations.push({
          expression,
          start: startPos,
          end: fullText.length,
        });

        fullText += `#{...}`;
      }
    }

    if (!fullText) {
      this.error("Expected string after 'say' keyword", this.peek());
    }

    this.consume("NEWLINE", "Expected newline after say statement");

    return {
      type: "Say",
      text: fullText,
      interpolations,
      line: sayToken.line,
      column: sayToken.column,
    };
  }

  private parseChoice(): ChoiceStatement {
    this.consume("CHOICE", "Expected 'choice' keyword");
    const text = this.consume("STRING", "Expected choice text");
    this.consume("COMMA", "Expected ',' after choice text");

    const colon = this.consume("COLON", "Expected ':' before target node identifier");

    const target = this.peek();
    if (target.type !== "IDENTIFIER") {
      let suggestion = "";
      if (
        target.type === "END" ||
        target.type === "NODE" ||
        target.type === "SAY"
      ) {
        suggestion = ` (Note: '${target.value}' is a keyword, use a different node name)`;
      }
      this.error(
        `Expected target node identifier after ':'${suggestion}`,
        target,
      );
    }
    this.advance(); // consume identifier

    let condition: Expression | undefined;
    if (this.match(["COMMA"])) {
      this.consume("IF", "Expected 'if' keyword for choice condition");
      this.consume("COLON", "Expected ':' after 'if' keyword");
      condition = this.parseExpression();
    }

    this.consume("NEWLINE", "Expected newline after choice statement");

    const choice: ChoiceStatement = {
      type: "Choice",
      text: text.value as string,
      target: target.value as string,
      line: colon.line,
      column: colon.column,
      textLine: text.line,
      textColumn: text.column,
    };

    if (condition) {
      choice.condition = condition;
    }

    return choice;
  }

  private parseGoto(): GotoStatement {
     this.consume("GOTO", "Expected 'goto' keyword");
    const colon = this.consume("COLON", "Expected ':' before node identifier");

    const target = this.peek();
    if (target.type !== "IDENTIFIER") {
      let suggestion = "";
      if (
        target.type === "END" ||
        target.type === "NODE" ||
        target.type === "SAY"
      ) {
        suggestion = ` (Note: '${target.value}' is a keyword, use a different node name)`;
      }
      this.error(
        `Expected target node identifier after ':'${suggestion}`,
        target,
      );
    }
    this.advance(); // consume identifier

    this.consume("NEWLINE", "Expected newline after goto statement");

    return {
      type: "Goto",
      target: target.value as string,
      line: colon.line,
      column: colon.column,
    };
  }

  // Parse expression using Precedence Climbing
  private parseExpression(): Expression {
    return this.parseLogicalOr();
  }

  private parseLogicalOr(): Expression {
    let expr = this.parseLogicalAnd();

    while (this.match(["OR"])) {
      const operator = this.getPreviousToken();
      const right = this.parseLogicalAnd();

      expr = {
        type: "BinaryOp",
        operator: operator.value as string,
        left: expr,
        right,
      };
    }

    return expr;
  }

  private parseLogicalAnd(): Expression {
    let expr = this.parseComparison();

    while (this.match(["AND"])) {
      const operator = this.getPreviousToken();
      const right = this.parseComparison();

      expr = {
        type: "BinaryOp",
        operator: operator.value as string,
        left: expr,
        right,
      };
    }

    return expr;
  }

  private parseComparison(): Expression {
    let expr = this.parseTerm();

    while (
      this.match([
        "EQUALS_EQUALS",
        "NOT_EQUALS",
        "GREATER",
        "GREATER_EQUALS",
        "LESS",
        "LESS_EQUALS",
      ])
    ) {
      const operator = this.getPreviousToken();
      const right = this.parseTerm();

      expr = {
        type: "BinaryOp",
        right,
        left: expr,
        operator: operator.value as string,
      };
    }

    return expr;
  }

  private parseTerm(): Expression {
    let expr = this.parseFactor();

    while (this.match(["PLUS", "MINUS"])) {
      const operator = this.getPreviousToken();
      const right = this.parseFactor();

      expr = {
        type: "BinaryOp",
        operator: operator.value as string,
        left: expr,
        right,
      };
    }

    return expr;
  }

  private parseFactor(): Expression {
    let expr = this.parseUnary();

    while (this.match(["STAR", "SLASH"])) {
      const operator = this.getPreviousToken();
      const right = this.parseUnary();

      expr = {
        type: "BinaryOp",
        operator: operator.value as string,
        left: expr,
        right,
      };
    }

    return expr;
  }

  private parseUnary(): Expression {
    if (this.match(["NOT", "MINUS"])) {
      const operator = this.getPreviousToken();
      const right = this.parseUnary();

      return {
        type: "UnaryOp",
        operator: operator.value as string,
        operand: right,
      };
    }

    return this.parsePrimary();
  }

  private parsePrimary(): Expression {
    if (this.match(["TRUE", "FALSE", "NUMBER", "STRING"])) {
      const token = this.getPreviousToken();
      let value: string | number | boolean = token.value;

      if (token.type === "TRUE") {
        value = true;
      } else if (token.type === "FALSE") {
        value = false;
      }

      return {
        type: "Literal",
        value: value,
      };
    }

    if (this.expect("AT_SIGN")) {
      const atSign = this.advance(); // Get the @ token for position
      const name = this.consume(
        "IDENTIFIER",
        "Expected variable name after '@'",
      );
      return {
        type: "Variable",
        name: name.value as string,
        line: atSign.line,
        column: atSign.column,
      };
    }

    if (
      this.peek().type === "IDENTIFIER" &&
      this.peekNext()?.type === "LEFT_PAREN"
    ) {
      return this.parseFunctionCall();
    }

    if (this.match(["LEFT_PAREN"])) {
      const expr = this.parseExpression();
      this.consume("RIGHT_PAREN", "Expected ')' after expression");
      return expr;
    }

    const token = this.peek();
    const expected = [
      "variable (@name)",
      "number",
      "string",
      "true/false",
      "function call",
      "parenthesized expression",
    ];
    this.error(
      `Expected an expression, got '${token.value}'. Valid expressions: ${expected.join(", ")}`,
      token,
    );
  }

  private parseFunctionCall(): Expression {
    const name = this.consume("IDENTIFIER", "Expected function name");
    this.consume("LEFT_PAREN", "Expected '(' after function name");
    const args: Expression[] = [];

    if (this.peek().type !== "RIGHT_PAREN") {
      args.push(this.parseExpression());

      while (this.match(["COMMA"])) {
        if (this.peek().type === "RIGHT_PAREN") {
          this.error(
            "Expected expression after ',' in function arguments",
            this.peek(),
          );
        }
        args.push(this.parseExpression());
      }
    }

    this.consume("RIGHT_PAREN", "Expected ')' after function arguments");

    return {
      type: "FunctionCall",
      name: name.value as string,
      args,
      line: name.line,
      column: name.column,
    };
  }

  private skipNewlines(): void {
    while (this.peek().type === "NEWLINE") {
      this.advance();
    }
  }

  private consume(expectedType: TokenType, errorMessage: string): Token {
    if (this.expect(expectedType)) return this.advance();

    const token = this.peek();
    let message = errorMessage;

    if (expectedType === "COLON" && token.type === "IDENTIFIER") {
      message += ". Did you forget ':' before the node name?";
    }
    if (expectedType === "COMMA" && token.type === "COLON") {
      message += ". Did you forget ',' between parameters?";
    }
    if (
      expectedType === "IDENTIFIER" &&
      (token.type === "END" || token.type === "NODE")
    ) {
      message += `. '${token.value}' is a keyword and cannot be used as an identifier`;
    }
    if (expectedType === "NEWLINE") {
      message += `. Got '${token.value}' instead. Check for missing operators or extra text`;
    }

    this.error(message, token);
  }

  private match(expectedTypes: TokenType[]): boolean {
    for (const type of expectedTypes) {
      if (this.expect(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private expect(expectedType: string): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === expectedType;
  }

  private advance(): Token {
    const prev = this.currentToken;
    this.previousToken = this.currentToken;
    this.currentToken = this.nextToken!;
    this.nextToken = this.pullToken();
    return prev;
  }

  private getPreviousToken(): Token {
    if (!this.previousToken) {
      throw new Error("No previous token available");
    }
    return this.previousToken;
  }

  private isAtEnd(): boolean {
    return this.peek().type === "EOF";
  }

  private peek(): Token {
    return this.currentToken;
  }

  private peekNext(): Token | null {
    return this.nextToken;
  }

  private error(message: string, token: Token): never {
    const sourceLine = this.sourceLines[token.line - 1];
    throw new ParserError(message, token.line, token.column, sourceLine);
  }
}
