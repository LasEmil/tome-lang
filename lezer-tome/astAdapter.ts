import type { SyntaxNode, Tree, TreeCursor } from "@lezer/common";
import {
  AssignmentOperator,
  AST,
  DialogueNode,
  Expression,
  Interpolation,
  Statement,
} from "../dsl/types";

// Helper to extract interpolations from strings (returns raw data)
interface RawInterpolation {
  text: string;
  start: number;
  end: number;
}

function extractRawInterpolations(str: string): RawInterpolation[] {
  const interpolations: RawInterpolation[] = [];
  const regex = /#\{([^}]+)\}/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(str)) !== null) {
    interpolations.push({
      text: match[1].trim(),
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return interpolations;
}

// Types for processed string literals
export interface SimpleString {
  type: "simple";
  value: string;
  raw: string;
}

export interface InterpolatedStringPart {
  type: "text" | "expression";
  value: string;
}

export interface InterpolatedString {
  type: "interpolated";
  parts: InterpolatedStringPart[];
  raw: string;
}

export type ProcessedString = SimpleString | InterpolatedString;

// Helper to process a string literal from the AST
export function processStringLiteral(
  stringNode: SyntaxNode,
  code: string,
): ProcessedString {
  const text = code.slice(stringNode.from, stringNode.to);
  const withoutQuotes = text.slice(1, -1); // Remove surrounding quotes

  const interpolations = extractRawInterpolations(withoutQuotes);

  if (interpolations.length === 0) {
    return {
      type: "simple",
      value: withoutQuotes,
      raw: text,
    };
  }

  // Build parts array
  const parts: InterpolatedStringPart[] = [];
  let lastEnd = 0;

  for (const interp of interpolations) {
    // Add text before interpolation
    if (interp.start > lastEnd) {
      parts.push({
        type: "text",
        value: withoutQuotes.slice(lastEnd, interp.start),
      });
    }

    // Add interpolation
    parts.push({
      type: "expression",
      value: interp.text,
    });

    lastEnd = interp.end;
  }

  // Add remaining text
  if (lastEnd < withoutQuotes.length) {
    parts.push({
      type: "text",
      value: withoutQuotes.slice(lastEnd),
    });
  }

  return {
    type: "interpolated",
    parts,
    raw: text,
  };
}

// Helper to convert Lezer tree to Tome AST format (matching dsl/types.ts)
export function toTomeAST(tree: Tree, code: string): AST {
  const ast: AST = {
    type: "Program",
    nodes: [],
  };

  const cursor = tree.cursor();

  do {
    if (cursor.name === "Node") {
      const dialogueNode = parseNode(cursor, code, tree);
      if (dialogueNode) {
        ast.nodes.push(dialogueNode);
      }
    }
  } while (cursor.next());

  return ast;
}

function getLineAndColumn(
  pos: number,
  code: string,
): { line: number; column: number } {
  const lines = code.slice(0, pos).split("\n");
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
}

function parseNode(
  nodeRef: TreeCursor,
  code: string,
  tree: Tree,
): DialogueNode | null {
  const cursor = tree.cursorAt(nodeRef.from);
  cursor.firstChild(); // Enter Node

  cursor.nextSibling(); // Skip "node" keyword

  // Get node identifier
  const nodeId = code.slice(cursor.from, cursor.to);
  const nodePos = getLineAndColumn(nodeRef.from, code);

  cursor.nextSibling(); // Newline
  cursor.nextSibling(); // Indent

  const statements: Statement[] = [];

  // Parse statements
  while (
    cursor.nextSibling() &&
    cursor.name !== "Dedent" &&
    cursor.name !== "end"
  ) {
    const stmt = parseStatement(cursor.node, code);
    if (stmt) {
      statements.push(stmt);
    }
  }

  return {
    type: "Node",
    id: nodeId,
    statements,
    line: nodePos.line,
    column: nodePos.column,
  };
}

function parseStatement(stmtNode: SyntaxNode, code: string): Statement | null {
  const name = stmtNode.type.name;
  const pos = getLineAndColumn(stmtNode.from, code);

  switch (name) {
    case "Say": {
      const text = code.slice(stmtNode.from, stmtNode.to);
      const stringMatch = text.match(/"([^"]*)"/);
      const stringContent = stringMatch ? stringMatch[1] : "";

      // Extract interpolations and convert to Expression format
      const rawInterpolations = extractRawInterpolations(stringContent);
      const interpolations: Interpolation[] = rawInterpolations.map(
        (interp) => ({
          expression: parseExpressionString(interp.text),
          start: interp.start,
          end: interp.end,
        }),
      );

      return {
        type: "Say",
        text: stringContent,
        interpolations,
        line: pos.line,
        column: pos.column,
      };
    }
    case "Choice": {
      const text = code.slice(stmtNode.from, stmtNode.to);
      // Parse: choice "text", :target, if: condition
      const parts = text.match(
        /choice\s+"([^"]+)"\s*,\s*:(\w+)(?:\s*,\s*if:\s*(.+))?/,
      );

      if (!parts) return null;

      return {
        type: "Choice",
        text: parts[1],
        target: parts[2],
        condition: parts[3]
          ? parseExpressionString(parts[3].trim())
          : undefined,
        line: pos.line,
        column: pos.column,
      };
    }
    case "Goto": {
      const text = code.slice(stmtNode.from, stmtNode.to);
      const targetMatch = text.match(/goto\s+:(\w+)/);

      return {
        type: "Goto",
        target: targetMatch ? targetMatch[1] : "",
        line: pos.line,
        column: pos.column,
      };
    }
    case "Assignment": {
      const text = code.slice(stmtNode.from, stmtNode.to);
      // Parse: @variable = value or @variable += value etc.
      const parts = text.match(/@(\w+)\s*(=|\+=|-=|\*=|\/=)\s*(.+)/);

      if (!parts) return null;

      return {
        type: "Assignment",
        variable: parts[1],
        operator: parts[2] as AssignmentOperator,
        value: parseExpressionString(parts[3].trim()),
        line: pos.line,
        column: pos.column,
      };
    }
    default:
      return null;
  }
}

// Simple expression parser (you may want to make this more robust)
function parseExpressionString(exprStr: string): Expression {
  // Handle literals
  if (exprStr === "true" || exprStr === "false") {
    return {
      type: "Literal",
      value: exprStr === "true",
    };
  }

  // Handle numbers
  const numMatch = exprStr.match(/^-?\d+(\.\d+)?$/);
  if (numMatch) {
    return {
      type: "Literal",
      value: parseFloat(exprStr),
    };
  }

  // Handle strings
  const strMatch = exprStr.match(/^"([^"]*)"$/);
  if (strMatch) {
    return {
      type: "Literal",
      value: strMatch[1],
    };
  }

  // Handle variables
  if (exprStr.startsWith("@")) {
    return {
      type: "Variable",
      name: exprStr.slice(1),
    };
  }

  // Handle function calls
  const funcMatch = exprStr.match(/^(\w+)\((.*)\)$/);
  if (funcMatch) {
    const args = funcMatch[2]
      .split(",")
      .map((arg) => parseExpressionString(arg.trim()))
      .filter((arg) => arg !== null);

    return {
      type: "FunctionCall",
      name: funcMatch[1],
      args,
    };
  }

  // Handle binary operators (simplified - you may want proper precedence parsing)
  for (const op of [
    "&&",
    "||",
    "==",
    "!=",
    ">=",
    "<=",
    ">",
    "<",
    "+",
    "-",
    "*",
    "/",
  ]) {
    const parts = exprStr.split(op);
    if (parts.length === 2) {
      return {
        type: "BinaryOp",
        operator: op,
        left: parseExpressionString(parts[0].trim()),
        right: parseExpressionString(parts[1].trim()),
      };
    }
  }

  // Handle unary operators
  if (exprStr.startsWith("!")) {
    return {
      type: "UnaryOp",
      operator: "!",
      operand: parseExpressionString(exprStr.slice(1).trim()),
    };
  }

  if (exprStr.startsWith("-")) {
    return {
      type: "UnaryOp",
      operator: "-",
      operand: parseExpressionString(exprStr.slice(1).trim()),
    };
  }

  // Fallback to literal
  return {
    type: "Literal",
    value: exprStr,
  };
}
