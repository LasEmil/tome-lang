import type { TokenType } from "./types.ts";

export const keywords = new Set([
  "node",
  "say",
  "choice",
  "goto",
  "if",
  "end",
] as const);

export const symbols = new Map<string, TokenType>([
  ["@", "AT_SIGN"],
  [":", "COLON"],
  [",", "COMMA"],
  ["(", "LEFT_PAREN"],
  [")", "RIGHT_PAREN"],
]);

export const operators = new Map<string, TokenType>([
  ["=", "EQUALS"],
  ["+=", "PLUS_EQUALS"],
  ["-=", "MINUS_EQUALS"],
  ["*=", "STAR_EQUALS"],
  ["/=", "SLASH_EQUALS"],
  ["==", "EQUALS_EQUALS"],
  ["!=", "NOT_EQUALS"],
  [">", "GREATER"],
  [">=", "GREATER_EQUALS"],
  ["<", "LESS"],
  ["<=", "LESS_EQUALS"],
  ["&&", "AND"],
  ["||", "OR"],
  ["!", "NOT"],
  ["+", "PLUS"],
  ["-", "MINUS"],
  ["*", "STAR"],
  ["/", "SLASH"],
]);

export const literalTypes = new Set([
  "number",
  "string",
  "true",
  "false",
] as const);
