import { Lexer } from "./dsl/lexer.ts";
import { Parser } from "./dsl/parser.ts";
import { testProgram as source } from "./data/testProgram.ts";
import { Analyzer } from "./dsl/analyzer.ts";
import { writeFileSync } from "node:fs";

// Option 1: Parse everything (returns AST)
// const lexer = new Lexer(source);
// const tokens = Array.from(lexer.tokenize());
// // writeFileSync("./data/tokens.json", JSON.stringify(tokens, null, 2));
// const parser = new Parser(lexer.tokenize(), source);
// const result = parser.parse();
//
// if (result.errors.length > 0) {
//   result.errors.forEach((err) => console.error(err.message));
// } else {
//   console.log(result.ast);
//   writeFileSync("./data/ast.json", JSON.stringify(result.ast, null, 2));
// }

// Option 2: Stream nodes one at a time (memory efficient)
const lexer = new Lexer(source);
const lexResult = lexer.lex();
const parser = new Parser(lexResult.value.values(), source);
// const analyzer = new Analyzer();

const result = parser.parse();

writeFileSync("./data/ast.json", JSON.stringify(result.value, null, 2));
// for (const node of parser.parseNodesStreaming()) {
//   console.log(`Analyzing node: ${node.id}`);
//   analyzer.analyzeNode(node);
// }

// const result = analyzer.finalizeAnalysis();
console.log(result);
