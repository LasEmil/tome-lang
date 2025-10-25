import type { SyntaxNode } from "web-tree-sitter";
import { RuntimeError } from "./errors.ts";
import type { VariableStore } from "./variableStore.ts";

export class ExpressionEvaluator {
  constructor(
    private variables: VariableStore,
    private sourceCode: string,
  ) {}

  evaluate(node?: SyntaxNode): unknown {
    if (!node) return 0;

    const type = node.type;

    // Expression wrapper - try to find the actual expression inside
    if (type === "expression") {
      // Check if it's a binary operation
      if (node.namedChildCount === 2) {
        // Binary operation: left operator right
        const left = this.evaluate(node.namedChildren[0]);
        // Find operator (it's an unnamed child)
        let operator = "";
        for (let i = 0; i < node.childCount; i++) {
          const child = node.children[i];
          if (!child?.isNamed) {
            const text = child?.text;
            if (text === undefined) continue;
            if (
              [
                "+",
                "-",
                "*",
                "/",
                "==",
                "!=",
                ">",
                "<",
                ">=",
                "<=",
                "&&",
                "||",
              ].includes(text)
            ) {
              operator = text;
              break;
            }
          }
        }
        const right = this.evaluate(node.namedChildren[1]);
        return this.evaluateBinaryOp(operator, left, right);
      }

      // Single child expression - unwrap it
      if (node.namedChildCount === 1) {
        return this.evaluate(node.namedChildren[0]);
      }

      // Try all children until we find something
      if (node.childCount === 1) {
        return this.evaluate(node.children[0]);
      }
    }

    // Primary expressions
    if (type === "primary_expression") {
      if (node.namedChildCount > 0) {
        return this.evaluate(node.namedChildren[0]);
      }
      return this.evaluate(node.children[0]);
    }

    // Literals
    if (type === "literal") {
      if (node.namedChildCount > 0) {
        return this.evaluate(node.namedChildren[0]);
      }
      return this.evaluate(node.children[0]);
    }

    if (type === "number_literal") {
      return parseFloat(node.text);
    }

    if (type === "string_literal") {
      // Remove quotes and handle escape sequences
      const text = node.text;
      return text.slice(1, -1).replace(/\\n/g, "\n").replace(/\\"/g, '"');
    }

    if (type === "boolean_literal") {
      return node.text === "true";
    }

    if (type === "true") {
      return true;
    }

    if (type === "false") {
      return false;
    }

    // Variables
    if (type === "variable") {
      // Find the identifier (skip '@' symbol)
      const identifier =
        node.namedChildren[0] ||
        node.children.find((c) => c.type === "identifier");
      if (identifier) {
        return this.variables.get(identifier.text);
      }
      // Fallback - get text after @
      const varName = node.text.slice(1);
      return this.variables.get(varName);
    }

    // Unary operations
    if (type === "unary_expression") {
      const operator = node.children[0]?.text;
      const operand = this.evaluate(node.children[1]);
      return this.evaluateUnaryOp(operator, operand);
    }

    // Function calls (random, etc.)
    if (type === "function_call") {
      const functionName = node.children.find(
        (c) => c.type === "identifier",
      )?.text;
      const argsNode = node.children.find((c) => c.type === "argument_list");
      const args = this.evaluateArguments(argsNode);
      if (!functionName) {
        throw new RuntimeError(
          "Function name not found",
          node.startPosition.row,
          node.startPosition.column,
        );
      }
      return this.callFunction(functionName, args);
    }

    // Parenthesized expression
    if (type === "parenthesized_expression") {
      return this.evaluate(node.children[1]); // Skip '(' and ')'
    }

    throw new RuntimeError(
      `Unknown expression type: ${type}`,
      node.startPosition.row,
      node.startPosition.column,
    );
  }

  private evaluateBinaryOp(op: string, left: unknown, right: unknown): unknown {
    switch (op) {
      case "+":
        // String concatenation if either side is string
        if (typeof left === "string" || typeof right === "string") {
          return String(left) + String(right);
        }
        return Number(left) + Number(right);

      case "-":
        return Number(left) - Number(right);

      case "*":
        return Number(left) * Number(right);

      case "/": {
        const divisor = Number(right);
        if (divisor === 0) {
          throw new RuntimeError("Division by zero");
        }
        return Number(left) / divisor;
      }

      case "==":
        return left == right;

      case "!=":
        return left != right;

      case ">":
        return Number(left) > Number(right);

      case "<":
        return Number(left) < Number(right);

      case ">=":
        return Number(left) >= Number(right);

      case "<=":
        return Number(left) <= Number(right);

      case "&&":
        return left && right;

      case "||":
        return left || right;

      default:
        throw new RuntimeError(`Unknown operator: ${op}`);
    }
  }

  private evaluateUnaryOp(op?: string, operand?: unknown): unknown {
    switch (op) {
      case "!":
        return !operand;
      case "-":
        return -Number(operand);
      default:
        throw new RuntimeError(`Unknown unary operator: ${op}`);
    }
  }

  private evaluateArguments(argsNode?: SyntaxNode): unknown[] {
    if (!argsNode) return [];

    const args: unknown[] = [];
    for (let i = 0; i < argsNode.childCount; i++) {
      const child = argsNode.children[i];
      if (child?.type === "expression") {
        args.push(this.evaluate(child));
      }
    }
    return args;
  }

  private callFunction(name: string, args: unknown[]): unknown {
    if (name === "random") {
      if (args.length !== 2) {
        throw new RuntimeError(
          `random() requires exactly 2 arguments, got ${args.length}`,
        );
      }
      const min = Math.floor(Number(args[0]));
      const max = Math.floor(Number(args[1]));
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    throw new RuntimeError(`Unknown function: ${name}`);
  }

  // String interpolation for say statements
  interpolateString(text: string): string {
    // Find all #{...} patterns
    const pattern = /#\{([^}]+)\}/g;
    return text.replace(pattern, (match, expression) => {
      try {
        // Parse and evaluate the expression inside #{}
        // For now, we'll handle simple variable references
        const trimmed = expression.trim();

        if (trimmed.startsWith("@")) {
          // Simple variable reference
          const varName = trimmed.slice(1);
          return String(this.variables.get(varName));
        }

        // For complex expressions, we'd need to parse the string
        // This is a simplified version - you might want to enhance this
        return String(this.variables.get(trimmed));
      } catch (error) {
        console.error("Interpolation error:", error);
        return match; // Return original if evaluation fails
      }
    });
  }
}
