import { test, describe } from "node:test";
import assert from "node:assert";
import { Lexer } from "./lexer.ts";

describe("DSL Lexer", () => {
  test("Tokenizes a simple node definition", () => {
    const source = `
node start
  say "Hello, #{@player_name}!"
  @met_player = true
  
  choice "Continue", :next
  choice "Shop", :shop, if: @gold >= 10
end
`;
    const lexer = new Lexer(source);
    const tokens = Array.from(lexer.tokenize());
    const expectedTokens = [
      { type: "NODE", value: "node", line: 2, column: 2 },
      { type: "IDENTIFIER", value: "start", line: 2, column: 7 },
      { type: "NEWLINE", value: "\n", line: 2, column: 12 },
      { type: "INDENT", value: 2, line: 3, column: 1 },
      { type: "SAY", value: "say", line: 3, column: 3 },
      {
        type: "STRING",
        value: "Hello, #{@player_name}!",
        line: 3,
        column: 7,
      },
      { type: "NEWLINE", value: "\n", line: 3, column: 32 },
      { type: "AT_SIGN", value: "@", line: 4, column: 3 },
      { type: "IDENTIFIER", value: "met_player", line: 4, column: 4 },
      { type: "EQUALS", value: "=", line: 4, column: 15 },
      { type: "TRUE", value: "true", line: 4, column: 17 },
      { type: "NEWLINE", value: "\n", line: 4, column: 21 },
      { type: "NEWLINE", value: "\n", line: 5, column: 3 },
      { type: "CHOICE", value: "choice", line: 6, column: 3 },
      { type: "STRING", value: "Continue", line: 6, column: 10 },
      { type: "COMMA", value: ",", line: 6, column: 20 },
      { type: "COLON", value: ":", line: 6, column: 22 },
      { type: "IDENTIFIER", value: "next", line: 6, column: 23 },
      { type: "NEWLINE", value: "\n", line: 6, column: 27 },
      { type: "CHOICE", value: "choice", line: 7, column: 3 },
      { type: "STRING", value: "Shop", line: 7, column: 10 },
      { type: "COMMA", value: ",", line: 7, column: 16 },
      { type: "COLON", value: ":", line: 7, column: 18 },
      { type: "IDENTIFIER", value: "shop", line: 7, column: 19 },
      { type: "COMMA", value: ",", line: 7, column: 23 },
      { type: "IF", value: "if", line: 7, column: 25 },
      { type: "COLON", value: ":", line: 7, column: 27 },
      { type: "AT_SIGN", value: "@", line: 7, column: 29 },
      { type: "IDENTIFIER", value: "gold", line: 7, column: 30 },
      { type: "GREATER_EQUALS", value: ">=", line: 7, column: 35 },
      { type: "NUMBER", value: 10, line: 7, column: 38 },
      { type: "NEWLINE", value: "\n", line: 7, column: 40 },
      { type: "DEDENT", value: 2, line: 8, column: 1 },
      { type: "END", value: "end", line: 8, column: 1 },
      { type: "NEWLINE", value: "\n", line: 8, column: 4 },
      { type: "EOF", value: "EOF", line: 9, column: 1 },
    ];
    assert.deepStrictEqual(tokens, expectedTokens);
  });
});
