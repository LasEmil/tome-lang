import type {
  AssignmentOperator,
  AssignmentStatement,
  AST,
  ChoiceStatement,
  DialogueNode,
  Expression,
  GotoStatement,
  Interpolation,
  SayStatement,
  Statement,
  Token,
  TokenType,
} from "./types.ts";

class ParserError extends Error {
  constructor(
    message: string,
    public position: string,
    public source?: string,
  ) {
    super(`Parse Error at position ${position}: ${message}`);
    this.name = "ParserError";
  }
}

export class Parser {
  private current = 0;
  constructor(public tokens: Token[]) {}

  public parse(): AST {
    const nodes: DialogueNode[] = [];
    while (!this.isAtEnd()) {
      const node = this.parseNode();
      if (node) {
        nodes.push(node);
      }
    }

    return {
      type: "Program",
      nodes,
    };
  }

  private parseNode(): DialogueNode {
    this.consume("NODE", "Expected 'node' keyword at the beginning of a node.");
    const nodeName = this.consume("IDENTIFIER", "Expected node identifier.");
    this.consume("NEWLINE", "Expected newline after node declaration.");
    this.consume("INDENT", "Expected indentation after node declaration.");

    const statements: Statement[] = [];

    while (!this.match(["DEDENT", "END"])) {
      statements.push(this.parseStatement());
    }
    return {
      type: "Node",
      id: nodeName.value as string,
      statements,
      line: nodeName.line,
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
      default:
        throw new ParserError(
          `Unexpected token '${token.value}'`,
          `line ${token.line}, column ${token.column}`,
        );
    }
  }

  private parseAssignment(): AssignmentStatement {
    this.consume("AT_SIGN", "Expected '@' at the beginning of variable.");
    const variable = this.consume("IDENTIFIER", "Expected variable name.");
    const operator = this.advance();
    const value = this.parseExpression();
    this.consume("NEWLINE", "Expected newline after assignment statement.");

    return {
      type: "Assignment",
      variable: variable.value as string,
      operator: operator.value as AssignmentOperator,
      value,
      line: variable.line,
    };
  }

  private parseSay(): SayStatement {
    this.consume("SAY", "Expected 'say' keyword.");

    let fullText = "";
    const interpolations: Interpolation[] = [];

    while (this.match(["STRING", "INTERPOLATION_START"])) {
      if (this.match(["STRING"])) {
        fullText += this.advance().value as string;
      } else {
        this.consume(
          "INTERPOLATION_START",
          "Expected '#{' for interpolation start.",
        );
        const expression = this.parseExpression();
        this.consume(
          "INTERPOLATION_END",
          "Expected '}' for interpolation end.",
        );

        interpolations.push({
          expression,
          start: fullText.length,
          end: fullText.length, // Placeholder, actual end position can be calculated later
        });
        fullText += `#{...}`;
      }
    }
    this.consume("NEWLINE", "Expected newline after say statement.");

    return {
      type: "Say",
      text: fullText,
      interpolations,
      line: this.peek().line,
    };
  }

  private parseChoice(): ChoiceStatement {
    this.consume("CHOICE", "Expected 'choice' keyword.");
    const text = this.consume("STRING", "Expected choice text.");
    this.consume("COMMA", "Expected ',' after choice text.");
    this.consume("COLON", "Expected ':' before target node identifier.");
    const target = this.consume(
      "IDENTIFIER",
      "Expected target node identifier.",
    );

    let condition: Expression | undefined;
    if (this.match(["COMMA"])) {
      this.advance();
      this.consume("IF", "Expected 'if' keyword for choice condition.");
      this.consume("COLON", "Expected ':' after 'if' keyword.");
      condition = this.parseExpression();
    }
    this.consume("NEWLINE", "Expected newline after choice statement.");
    const choice: ChoiceStatement = {
      type: "Choice",
      text: text.value as string,
      target: target.value as string,
      line: text.line,
    };
    if (condition) {
      choice.condition = condition;
    }

    return choice;
  }

  private parseGoto(): GotoStatement {
    this.consume("GOTO", "Expected 'goto' keyword.");
    this.consume("COLON", "Expected ':' before node identifier.");
    const target = this.consume(
      "IDENTIFIER",
      "Expected target node identifier.",
    );
    this.consume("NEWLINE", "Expected newline after goto statement.");

    return {
      type: "Goto",
      target: target.value as string,
      line: target.line,
    };
  }

  // Parse expression using Precendence Climbing
  private parseExpression(): Expression {
    return {} as Expression;
  }

  private consume(expectedType: TokenType, errorMessage: string): Token {
    if (this.expect(expectedType)) return this.advance();

    const token = this.peek();
    throw new ParserError(
      errorMessage,
      `line ${token.line}, column ${token.column}`,
    );
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
    if (!this.isAtEnd()) this.current++;
    return this.tokens[this.current - 1]!;
  }

  private isAtEnd(): boolean {
    return this.peek().type === "EOF";
  }

  private peek(): Token {
    return this.tokens[this.current]!;
  }
}
