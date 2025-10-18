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
  line: number;
  column: number;
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
}

export interface VariableExpression {
  type: "Variable";
  name: string;
}

export interface BinaryExpression {
  type: "BinaryOp";
  operator: string;
  left: Expression;
  right: Expression;
}

export interface UnaryExpression {
  type: "UnaryOp";
  operator: string;
  operand: Expression;
}

export interface FunctionCallExpression {
  type: "FunctionCall";
  name: string;
  args: Expression[];
}
