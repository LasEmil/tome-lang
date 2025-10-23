import type { ParserError } from "./parser.ts";

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

  // String Interpolation
  | "INTERPOLATION_START" // #{
  | "INTERPOLATION_END" // }

  // Comments
  | "COMMENT"; // # comment

export interface Token {
  type: TokenType;
  value: string | number;
  line: number;
  column: number;
}
export interface AST {
  type: "Program";
  nodes: DialogueNode[];
}

export interface DialogueNode {
  type: "Node";
  id: string;
  statements: Statement[];
  line: number;
  column: number;
}

export type Statement =
  | AssignmentStatement
  | SayStatement
  | ChoiceStatement
  | GotoStatement;

export type AssignmentOperator = "=" | "+=" | "-=" | "*=" | "/=";
export interface AssignmentStatement {
  type: "Assignment";
  variable: string;
  operator: AssignmentOperator;
  value: Expression;
  line: number;
  column: number;
}

export interface SayStatement {
  type: "Say";
  text: string;
  interpolations: Interpolation[];
  line: number;
  column: number;
}

export interface Interpolation {
  expression: Expression;
  start: number; // position in string
  end: number;
}

export interface ChoiceStatement {
  type: "Choice";
  text: string;
  target: string;
  condition?: Expression;
  line: number; // Position of the target (colon)
  column: number; // Position of the target (colon)
  textLine?: number; // Position of the choice text
  textColumn?: number; // Position of the choice text
}

export interface GotoStatement {
  type: "Goto";
  target: string;
  line: number;
  column: number;
}

export type Expression =
  | LiteralExpression
  | VariableExpression
  | BinaryExpression
  | UnaryExpression
  | FunctionCallExpression;

export interface LiteralExpression {
  type: "Literal";
  value: string | number | boolean;
  line: number;
  column: number;
  endColumn: number;
}

export interface VariableExpression {
  type: "Variable";
  name: string;
  line: number;
  column: number;
  endColumn: number;
}

export interface BinaryExpression {
  type: "BinaryOp";
  operator: string;
  left: Expression;
  right: Expression;
  line: number;
  column: number;
  endColumn: number;
}

export interface UnaryExpression {
  type: "UnaryOp";
  operator: string;
  operand: Expression;
  line: number;
  column: number;
  endColumn: number;
}

export interface FunctionCallExpression {
  type: "FunctionCall";
  name: string;
  args: Expression[];
  line: number;
  column: number;
  endColumn: number;
}

export type AnalysisErrorType =
  | "missing_node"
  | "duplicate_node"
  | "invalid_function"
  | "invalid_function_args"
  | "missing_entry_point"
  | "empty_node"
  | "invalid_expression";

export type AnalysisWarningType =
  | "unreachable_node"
  | "dead_end"
  | "undefined_variable"
  | "unused_variable"
  | "circular_reference"
  | "type_mismatch"
  | "suspicious_condition"
  | "identical_choice";

export interface AnalysisError {
  type: AnalysisErrorType;
  message: string;
  line: number;
  column: number;
  endColumn: number;
  node?: string; // Which node the error is in
  severity: "error";
}

export interface AnalysisWarning {
  type: AnalysisWarningType;
  message: string;
  line: number;
  column: number;
  node?: string; // Which node the warning is in
  severity: "warning";
  endColumn: number;
}

export interface AnalysisSuggestion {
  type: string;
  message: string;
  line: number;
  column: number;
  node?: string;
  severity: "info";
  fix?: string; // Optional auto-fix suggestion
  endColumn: number;
}

export interface AnalysisResult {
  valid: boolean; // true if no errors (warnings are OK)
  errors: AnalysisError[];
  warnings: AnalysisWarning[];
  suggestions: AnalysisSuggestion[];
}

export interface Reference {
  target: string;
  line: number;
  column: number;
  type: "choice" | "goto";
  sourceNode: string;
}

export type Diagnostic = AnalysisError | AnalysisWarning | AnalysisSuggestion;

export type InferredType = "number" | "string" | "boolean" | "any";

export const SeverityLevels = ["error", "warning", "info"] as const;
export type SeverityLevel = (typeof SeverityLevels)[number];

export type NodeNetwork = {
  nodes: Set<string>;
  links: { source: string; target: string }[];
};

export interface ParseResult {
  value: AST | null;
  errors: ParserError[];
  valid: boolean;
}
