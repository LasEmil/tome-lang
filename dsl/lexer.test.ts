import { test, describe } from "node:test";
import assert from "node:assert";
import { Lexer } from "./lexer.ts";
import { testProgram } from "../data/testProgram.ts";
import expectedTokens from "../data/tokens.json";

describe("DSL Lexer", () => {
  test("Tokenizes a simple node definition", () => {
    const lexer = new Lexer(testProgram);
    const tokens = Array.from(lexer.tokenize());
    assert.deepStrictEqual(tokens, expectedTokens);
  });
});
