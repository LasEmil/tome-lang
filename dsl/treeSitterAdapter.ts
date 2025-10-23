import type { SyntaxNode } from "web-tree-sitter";
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
} from "./types.ts";
import { treeSitterNodeTypes } from "./constants.ts";

interface Tree {
  rootNode: SyntaxNode;
}

export interface ParseResult {
  value: AST | null;
  errors: ParserError[];
  valid: boolean;
}

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

export class TreeSitterAdapter {
  private errors: ParserError[] = [];
  private sourceLines: string[] = [];

  public convert(tree: Tree, source?: string): ParseResult {
    this.errors = [];
    this.sourceLines = source ? source.split("\n") : [];

    const rootNode = tree.rootNode;

    if (rootNode.type !== "source_file") {
      this.addError(
        `Expected source_file root node, got '${rootNode.type}'`,
        1,
        1,
      );
      return {
        value: null,
        errors: this.errors,
        valid: false,
      };
    }

    // Check for tree-sitter parse errors
    if (rootNode.hasError) {
      this.collectTreeSitterErrors(rootNode);
    }

    const nodes: DialogueNode[] = [];

    for (const child of rootNode.namedChildren) {
      if (child.type === "node_definition") {
        try {
          nodes.push(this.convertNodeDefinition(child));
        } catch (e) {
          // Individual node conversion errors are already collected via addError
          // Continue processing other nodes
          if (!(e instanceof Error)) {
            throw e;
          }
        }
      }
      // Note: ERROR nodes are already handled by collectTreeSitterErrors
    }

    const valid = this.errors.length === 0;

    return {
      value: valid ? { type: "Program", nodes } : null,
      errors: this.errors,
      valid,
    };
  }

  private collectTreeSitterErrors(node: SyntaxNode): void {
    if (node.type === "ERROR") {
      // Truncate error text to first line and limit length
      const firstLine = node.text.split("\n")[0].trim();
      const truncatedText = firstLine.length > 30
        ? firstLine.slice(0, 30) + "..."
        : firstLine;

      const errorMessage = truncatedText
        ? `Syntax error: unexpected '${truncatedText}'`
        : "Syntax error";

      this.addError(
        errorMessage,
        node.startPosition.row + 1,
        node.startPosition.column + 1,
      );
      return; // Don't recurse into ERROR node children
    }

    if (node.isMissing) {
      this.addError(
        `Missing ${node.type}`,
        node.startPosition.row + 1,
        node.startPosition.column + 1,
      );
    }

    // Recurse into children
    for (const child of node.children) {
      if (child.hasError) {
        this.collectTreeSitterErrors(child);
      }
    }
  }

  private addError(message: string, line: number, column: number): void {
    const sourceLine = this.sourceLines[line - 1];
    this.errors.push(new ParserError(message, line, column, sourceLine));
  }

  private convertNodeDefinition(node: SyntaxNode): DialogueNode {
    const nameNode = node.childForFieldName("name");
    if (!nameNode) {
      this.addError(
        "Node definition missing name field",
        node.startPosition.row + 1,
        node.startPosition.column + 1,
      );
      throw new Error("Node definition missing name field");
    }

    const id = nameNode.text;
    const statements: Statement[] = [];

    // Walk through the node body to collect statements
    for (const child of node.namedChildren) {
      if (
        child.type === "assignment_statement" ||
        child.type === "say_statement" ||
        child.type === "choice_statement" ||
        child.type === "goto_statement"
      ) {
        try {
          statements.push(this.convertStatement(child));
        } catch (e) {
          // Error already collected, continue with other statements
          if (!(e instanceof Error)) {
            throw e;
          }
        }
      }
    }

    return {
      type: "Node",
      id,
      statements,
      line: nameNode.startPosition.row + 1,
      column: nameNode.startPosition.column + 1,
    };
  }

  private convertStatement(node: SyntaxNode): Statement {
    switch (node.type) {
      case "assignment_statement":
        return this.convertAssignment(node);
      case "say_statement":
        return this.convertSay(node);
      case "choice_statement":
        return this.convertChoice(node);
      case "goto_statement":
        return this.convertGoto(node);
      default:
        this.addError(
          `Unknown statement type: ${node.type}`,
          node.startPosition.row + 1,
          node.startPosition.column + 1,
        );
        throw new Error(`Unknown statement type: ${node.type}`);
    }
  }

  private convertAssignment(node: SyntaxNode): AssignmentStatement {
    // Find the variable node (which is @identifier)
    let variableNode: SyntaxNode | null = null;
    let operatorNode: SyntaxNode | null = null;
    let expressionNode: SyntaxNode | null = null;

    for (const child of node.children) {
      if (child.type === "variable") {
        variableNode = child;
      } else if (["=", "+=", "-=", "*=", "/="].includes(child.type)) {
        operatorNode = child;
      } else if (child.type === "expression") {
        expressionNode = child;
      }
    }

    if (!variableNode || !operatorNode || !expressionNode) {
      this.addError(
        "Invalid assignment statement structure",
        node.startPosition.row + 1,
        node.startPosition.column + 1,
      );
      throw new Error("Invalid assignment statement structure");
    }

    // Extract variable name (skip the @ symbol)
    const identifierNode = variableNode.namedChildren[0];
    const variable = identifierNode ? identifierNode.text : variableNode.text.slice(1);

    const operator = operatorNode.text as AssignmentOperator;
    const value = this.convertExpression(expressionNode);

    return {
      type: "Assignment",
      variable,
      operator,
      value,
      line: variableNode.startPosition.row + 1,
      column: variableNode.startPosition.column + 2, // +2 to skip the @ symbol
    };
  }

  private convertSay(node: SyntaxNode): SayStatement {
    // Find the string_literal child
    let stringNode: SyntaxNode | null = null;

    for (const child of node.namedChildren) {
      if (child.type === "string_literal") {
        stringNode = child;
        break;
      }
    }

    if (!stringNode) {
      this.addError(
        "Say statement missing string literal",
        node.startPosition.row + 1,
        node.startPosition.column + 1,
      );
      throw new Error("Say statement missing string literal");
    }

    const { text, interpolations } = this.extractStringWithInterpolations(stringNode);

    return {
      type: "Say",
      text,
      interpolations,
      line: node.startPosition.row + 1,
      column: node.startPosition.column + 1,
    };
  }

  private convertChoice(node: SyntaxNode): ChoiceStatement {
    const textNode = node.childForFieldName("text");
    if (!textNode) {
      this.addError(
        "Choice statement missing text field",
        node.startPosition.row + 1,
        node.startPosition.column + 1,
      );
      throw new Error("Choice statement missing text field");
    }

    // Extract the string content (remove quotes)
    const text = this.extractStringContent(textNode);

    // Find the node_reference to get the target
    let targetNode: SyntaxNode | null = null;
    for (const child of node.namedChildren) {
      if (child.type === "node_reference") {
        targetNode = child.childForFieldName("target");
        break;
      }
    }

    if (!targetNode) {
      this.addError(
        "Choice statement missing target node",
        node.startPosition.row + 1,
        node.startPosition.column + 1,
      );
      throw new Error("Choice statement missing target node");
    }

    const target = targetNode.text;

    // Check for optional condition
    let condition: Expression | undefined;
    for (const child of node.namedChildren) {
      if (child.type === "condition_clause") {
        const conditionNode = child.childForFieldName("condition");
        if (conditionNode) {
          condition = this.convertExpression(conditionNode);
        }
        break;
      }
    }

    const choice: ChoiceStatement = {
      type: "Choice",
      text,
      target,
      line: textNode.startPosition.row + 1,
      column: textNode.startPosition.column + 2, // +2 to skip the opening quote
    };

    if (condition) {
      choice.condition = condition;
    }

    return choice;
  }

  private convertGoto(node: SyntaxNode): GotoStatement {
    // Find the node_reference child
    let targetNode: SyntaxNode | null = null;

    for (const child of node.namedChildren) {
      if (child.type === "node_reference") {
        targetNode = child.childForFieldName("target");
        break;
      }
    }

    if (!targetNode) {
      this.addError(
        "Goto statement missing target node",
        node.startPosition.row + 1,
        node.startPosition.column + 1,
      );
      throw new Error("Goto statement missing target node");
    }

    return {
      type: "Goto",
      target: targetNode.text,
      line: node.startPosition.row + 1,
      column: node.startPosition.column + 1,
    };
  }

  private convertExpression(node: SyntaxNode): Expression {
    // Check if this is a binary operation (has left, operator, right fields)
    const leftNode = node.childForFieldName("left");
    const rightNode = node.childForFieldName("right");
    const operatorField = node.childForFieldName("operator");

    if (leftNode && rightNode && operatorField) {
      return {
        type: "BinaryOp",
        operator: operatorField.text,
        left: this.convertExpression(leftNode),
        right: this.convertExpression(rightNode),
      };
    }

    // Check if this is a unary operation (has operator and operand fields)
    const operandNode = node.childForFieldName("operand");
    if (operatorField && operandNode) {
      return {
        type: "UnaryOp",
        operator: operatorField.text,
        operand: this.convertExpression(operandNode),
      };
    }

    // Check for primary expressions
    for (const child of node.namedChildren) {
      if (child.type === "primary_expression") {
        return this.convertPrimary(child);
      } else if (
        child.type === "literal" ||
        child.type === "variable" ||
        child.type === "function_call"
      ) {
        // Sometimes these are direct children
        return this.convertPrimary(child);
      } else if (child.type === "expression") {
        // Parenthesized expression
        return this.convertExpression(child);
      }
    }

    // If we reach here, try to convert the node itself as a primary
    return this.convertPrimary(node);
  }

  private convertPrimary(node: SyntaxNode): Expression {
    // If this is a primary_expression wrapper, recurse into its children
    if (node.type === "primary_expression") {
      for (const child of node.namedChildren) {
        return this.convertPrimary(child);
      }
    }

    // Handle literal
    if (node.type === "literal") {
      for (const child of node.namedChildren) {
        if (child.type === "number_literal") {
          return {
            type: "Literal",
            value: parseFloat(child.text),
          };
        } else if (child.type === "boolean_literal") {
          return {
            type: "Literal",
            value: child.text === "true",
          };
        } else if (child.type === "string_literal") {
          return {
            type: "Literal",
            value: this.extractStringContent(child),
          };
        }
      }
    }

    // Handle direct literal types
    if (node.type === "number_literal") {
      return {
        type: "Literal",
        value: parseFloat(node.text),
      };
    }

    if (node.type === "boolean_literal") {
      return {
        type: "Literal",
        value: node.text === "true",
      };
    }

    if (node.type === "string_literal") {
      return {
        type: "Literal",
        value: this.extractStringContent(node),
      };
    }

    // Handle variable
    if (node.type === "variable") {
      // Extract identifier (skip @ symbol)
      const identifierNode = node.namedChildren[0];
      const name = identifierNode ? identifierNode.text : node.text.slice(1);
      return {
        type: "Variable",
        name,
      };
    }

    // Handle function call
    if (node.type === "function_call") {
      return this.convertFunctionCall(node);
    }

    // Handle parenthesized expression
    for (const child of node.namedChildren) {
      if (child.type === "expression") {
        return this.convertExpression(child);
      }
    }

    this.addError(
      `Unable to convert primary expression: ${node.type}`,
      node.startPosition.row + 1,
      node.startPosition.column + 1,
    );
    throw new Error(`Unable to convert primary expression: ${node.type}`);
  }

  private convertFunctionCall(node: SyntaxNode): Expression {
    const nameNode = node.childForFieldName("name");
    if (!nameNode) {
      this.addError(
        "Function call missing name",
        node.startPosition.row + 1,
        node.startPosition.column + 1,
      );
      throw new Error("Function call missing name");
    }

    const args: Expression[] = [];

    // Collect all expression children as arguments
    for (const child of node.namedChildren) {
      if (child.type === "expression") {
        args.push(this.convertExpression(child));
      }
    }

    return {
      type: "FunctionCall",
      name: nameNode.text,
      args,
    };
  }

  private extractStringWithInterpolations(
    node: SyntaxNode,
  ): { text: string; interpolations: Interpolation[] } {
    let text = "";
    const interpolations: Interpolation[] = [];
    let hasContent = false;

    for (const child of node.children) {
      if (child.type === "_string_content") {
        text += child.text;
        hasContent = true;
      } else if (child.type === "interpolation") {
        const startPos = text.length;

        // Find the expression inside the interpolation
        let expressionNode: SyntaxNode | null = null;
        for (const interpChild of child.namedChildren) {
          if (interpChild.type === "expression") {
            expressionNode = interpChild;
            break;
          }
        }

        if (expressionNode) {
          interpolations.push({
            expression: this.convertExpression(expressionNode),
            start: startPos,
            end: text.length,
          });
        }

        text += "#{...}";
        hasContent = true;
      } else if (child.type === "escape_sequence") {
        // Handle escape sequences (convert \n to actual newline, etc.)
        const escaped = child.text;
        switch (escaped) {
          case "\\n":
            text += "\n";
            break;
          case "\\t":
            text += "\t";
            break;
          case "\\r":
            text += "\r";
            break;
          case '\\"':
            text += '"';
            break;
          case "\\\\":
            text += "\\";
            break;
          default:
            // For any other escape, just take the character after backslash
            text += escaped.length > 1 ? escaped.slice(1) : escaped;
        }
        hasContent = true;
      }
    }

    // If no content was found through children, fall back to stripping quotes from node.text
    if (!hasContent && node.text.length >= 2) {
      const fullText = node.text;
      if (fullText.startsWith('"') && fullText.endsWith('"')) {
        text = fullText.slice(1, -1);
      } else {
        text = fullText;
      }
    }

    return { text, interpolations };
  }

  private extractStringContent(node: SyntaxNode): string {
    const { text } = this.extractStringWithInterpolations(node);
    return text;
  }
}
