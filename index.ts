import { Lexer } from "./dsl/lexer.ts";
import { Parser } from "./dsl/parser.ts";
import { testProgram as source } from "./data/testProgram.ts";

// Option 1: Parse everything (returns AST)
const lexer = new Lexer(source);
const parser = new Parser(lexer.tokenize(), source);
const result = parser.parse();

if (result.errors.length > 0) {
  result.errors.forEach((err) => console.error(err.message));
} else {
  console.log(result.ast);
}

// Option 2: Stream nodes one at a time (memory efficient)
// const lexer = new Lexer(source);
// const parser = new Parser(lexer.tokenize(), source);
//
// for (const node of parser.parseNodesStreaming()) {
//   console.log(node);
//   // validateNode(node);
//   // generateXStateForNode(node);
//   // Never loads all nodes into memory!
// }
