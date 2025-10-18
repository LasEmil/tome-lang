import { test, describe } from "node:test";
import assert from "node:assert";
import { Parser } from "./parser.ts";
import { Lexer } from "./lexer.ts";
import { testProgram } from "../data/testProgram.ts";
import expectedAST from "../data/ast.json";

describe("DSL Parser", () => {
  test("Parses complex dialogue script", () => {
    const lexer = new Lexer(testProgram);

    const parser = new Parser(lexer.tokenize(), testProgram);
    const result = parser.parse();
    const ast = result.ast!;
    assert.strictEqual(ast.type, "Program");
    assert.strictEqual(ast.nodes.length, 11); // 11 nodes defined

    assert.deepStrictEqual(ast, expectedAST);
  });
});
