import { test, describe } from "node:test";
import assert from "node:assert";
import { Analyzer } from "./analyzer.ts";
import type { AnalysisResult } from "./../dsl/types.ts";
import Parser from "web-tree-sitter";

describe("DSL AnalyzerTS", () => {
  const prepareAnalysis = async (source: string): Promise<AnalysisResult> => {
    await Parser.init();
    const parser = new Parser();

    const Lang = await Parser.Language.load(
      "tree-sitter-tome/tree-sitter-tome.wasm",
    );
    parser.setLanguage(Lang);
    const tree = parser.parse(source);
    const analyzer = new Analyzer(tree, source);
    const result = analyzer.analyze();
    return result;
  };

  test("Checks empty nodes", async () => {
    const source = `
node empty
end

node start
  say "Hello!"
end
`;

    const result = await prepareAnalysis(source);

    // Should have one error
    assert.strictEqual(result.errors.length, 1);
    assert.strictEqual(result?.errors?.[0]?.type, "empty_node");
    assert.strictEqual(result?.errors?.[0]?.node, "empty");
    assert.match(result?.errors?.[0]?.message, /empty.*no statements/i);

    // Should not be valid
    assert.strictEqual(result.valid, false);
  });

  test("Valid nodes are not flagged as empty", async () => {
    const source = `
node start
  say "Hello, world!"
  choice "Continue", :next
end

node next
  @value = 100
  goto :start
end
`;

    const result = await prepareAnalysis(source);

    // Should have no empty node errors
    const emptyNodeErrors = result.errors.filter(
      (e) => e.type === "empty_node",
    );
    assert.strictEqual(emptyNodeErrors.length, 0);
  });

  test("Multiple empty nodes are all detected", async () => {
    const source = `
node empty1
end

node empty2
end

node valid
  say "I have content"
end

node empty3
end
`;

    const result = await prepareAnalysis(source);

    // Should have three empty node errors
    const emptyNodeErrors = result.errors.filter(
      (e) => e.type === "empty_node",
    );
    assert.strictEqual(emptyNodeErrors.length, 3);

    // Check they're the right nodes
    const emptyNodeNames = emptyNodeErrors.map((e) => e.node).sort();
    assert.deepStrictEqual(emptyNodeNames, ["empty1", "empty2", "empty3"]);
  });

  test("Checks for duplicate nodes", async () => {
    const source = `
node start
  say "First definition"
end

node duplicate_id
  say "This one is okay"
end

node start
  say "Second definition"
end
`;

    const result = await prepareAnalysis(source);

    assert.strictEqual(result.errors.length, 1, "Should have one error");
    const error = result.errors[0];
    assert.strictEqual(error?.type, "duplicate_node");
    assert.strictEqual(error?.node, "start");
    assert.match(
      error?.message,
      /Duplicate node definition for 'start'. It was first defined on line 2./i,
    );
    assert.strictEqual(
      error?.line,
      10,
      "Error should be on the duplicate line",
    );
    assert.strictEqual(result.valid, false);
  });

  test("No errors for unique node names", async () => {
    const source = `
node start
  say "Hello"
end

node next_step
  say "World"
end
`;
    const result = await prepareAnalysis(source);
    const duplicateErrors = result.errors.filter(
      (e) => e.type === "duplicate_node",
    );
    assert.strictEqual(duplicateErrors.length, 0);
    assert.strictEqual(result.valid, true);
  });

  test("Detects multiple different duplicate nodes", async () => {
    const source = `
node first
  say "A"
end

node second
  say "B"
end

node first
  say "C"
end

node third
  say "D"
end

node second
  say "E"
end
`;
    const result = await prepareAnalysis(source);
    const duplicateErrors = result.errors.filter(
      (e) => e.type === "duplicate_node",
    );
    assert.strictEqual(duplicateErrors.length, 2);

    const errorNodes = duplicateErrors.map((e) => e.node).sort();
    assert.deepStrictEqual(errorNodes, ["first", "second"]);

    // Check the first duplicate error message
    const firstError = duplicateErrors.find((e) => e.node === "first");
    if (!firstError) throw new Error("First duplicate error not found");
    assert.match(firstError?.message, /first defined on line 2/i);
    assert.strictEqual(firstError?.line, 10);

    // Check the second duplicate error message
    const secondError = duplicateErrors.find((e) => e.node === "second");
    if (!secondError) throw new Error("Second duplicate error not found");
    assert.match(secondError?.message, /first defined on line 6/i);
    assert.strictEqual(secondError?.line, 18);

    assert.strictEqual(result.valid, false);
  });

  test("Validates function calls correctly", async () => {
    const source = `
node start
  @gold = random(10, 50)
  say "Your new total is #{@gold}."
  choice "Continue", :next, if: random(1, 2) == 1
end

node next
  say "End."
end
`;
    const result = await prepareAnalysis(source);
    const functionErrors = result.errors.filter(
      (e) =>
        e.type === "invalid_function" || e.type === "invalid_function_args",
    );
    assert.strictEqual(
      functionErrors.length,
      0,
      "Should have no function errors",
    );
    assert.strictEqual(result.valid, true);
  });

  test("Detects unknown function names", async () => {
    const source = `
node start
  @value = calculate_damage(10)
end
`;
    const result = await prepareAnalysis(source);
    assert.strictEqual(result.errors.length, 1);
    const error = result.errors[0];
    assert.strictEqual(error?.type, "invalid_function");
    assert.match(error?.message, /Unknown function called: 'calculate_damage'/);
    assert.strictEqual(error?.node, "start");
  });

  test("Detects incorrect number of arguments for 'random'", async () => {
    const source = `
node start
  # Too few
  @one = random(1)

  # Too many
  @three = random(1, 10, 100)
end
`;
    const result = await prepareAnalysis(source);
    assert.strictEqual(result.errors.length, 2);

    const error1 = result.errors.find((e) => e.message.includes("got 1"));
    assert.ok(error1, "Should find error for one argument");
    assert.strictEqual(error1?.type, "invalid_function_args");

    const error2 = result.errors.find((e) => e.message.includes("got 3"));
    assert.ok(error2, "Should find error for three arguments");
    assert.strictEqual(error2?.type, "invalid_function_args");
  });

  test("Detects invalid function calls nested in expressions", async () => {
    const source = `
node start
    @value = 10 + unknown_func(5 * 2)
end
`;
    const result = await prepareAnalysis(source);
    assert.strictEqual(result.errors.length, 1);
    const error = result.errors[0];
    assert.strictEqual(error?.type, "invalid_function");
    assert.match(error?.message, /'unknown_func'/);
  });

  test("Detects invalid function calls in choice conditions and interpolations", async () => {
    const source = `
node start
    choice "Press me", :next, if: bad(1,2)
    say "Result: #{random(1,2,3)}"
end
node next
  say "..."
end
`;
    const result = await prepareAnalysis(source);
    assert.strictEqual(result.errors.length, 2);

    const choiceError = result.errors.find(
      (e) => e.type === "invalid_function",
    );
    assert.ok(choiceError);
    assert.match(choiceError?.message, /'bad'/);

    const sayError = result.errors.find(
      (e) => e.type === "invalid_function_args",
    );
    assert.ok(sayError);
    assert.match(sayError?.message, /'random'.*expects exactly 2.*got 3/);
  });

  test("Detects unreachable nodes", async () => {
    const source = `
node start
  say "Go to next"
  goto :next
end

node next
  say "End of the line"
end

node island
  say "I am not connected to anything"
end
`;
    const result = await prepareAnalysis(source);

    const unreachableWarnings = result.warnings.filter(
      (w) => w.type === "unreachable_node",
    );
    assert.strictEqual(
      unreachableWarnings.length,
      1,
      "Should have one unreachable warning",
    );

    const warning = unreachableWarnings[0];
    assert.strictEqual(warning?.type, "unreachable_node");
    assert.strictEqual(warning?.node, "island");
    assert.match(warning?.message, /'island' is unreachable/);
    assert.strictEqual(
      warning?.line,
      11,
      "Warning should point to the correct line",
    );
    assert.strictEqual(
      result.valid,
      true,
      "Unreachable nodes are warnings, not errors",
    );
  });

  test("Does not flag fully connected graphs", async () => {
    const source = `
node start
    choice "Shop", :shop
    choice "Quests", :quests
end

node shop
    goto :start
end

node quests
    goto :start
end
`;
    const result = await prepareAnalysis(source);
    const unreachableWarnings = result.warnings.filter(
      (w) => w.type === "unreachable_node",
    );
    assert.strictEqual(unreachableWarnings.length, 0);
  });

  test("Detects multiple separate unreachable nodes", async () => {
    const source = `
node start
    say "Hello"
end

node forest
    say "Trees"
end

node cave
    say "Bats"
end
`;
    const result = await prepareAnalysis(source);

    const unreachableWarnings = result.warnings.filter(
      (w) => w.type === "unreachable_node",
    );
    assert.strictEqual(unreachableWarnings.length, 2);

    const unreachableNodes = unreachableWarnings.map((w) => w.node).sort();
    assert.deepStrictEqual(unreachableNodes, ["cave", "forest"]);
  });

  test("Handles graphs with cycles correctly", async () => {
    const source = `
node start
    goto :loop
end

node loop
    choice "Go back", :start
    choice "Go forward", :end
end

node end
    say "Finished"
end

node unreachable
    say "Still can't get to me"
end
`;
    const result = await prepareAnalysis(source);

    const unreachableWarnings = result.warnings.filter(
      (w) => w.type === "unreachable_node",
    );
    assert.strictEqual(unreachableWarnings.length, 1);
    assert.strictEqual(unreachableWarnings[0]?.node, "unreachable");
  });

  test("Detects a simple two-node circular 'goto' reference", async () => {
    const source = `
node a
  goto :b
end

node b
  goto :a
end
`;
    const result = await prepareAnalysis(source);
    assert.strictEqual(
      result.warnings.length,
      2,
      "Should have two warnings, one for each node in the cycle",
    );

    const circularWarnings = result.warnings.filter(
      (w) => w.type === "circular_reference",
    );
    assert.strictEqual(circularWarnings.length, 2);

    const nodesInWarning = circularWarnings.map((w) => w.node).sort();
    assert.deepStrictEqual(nodesInWarning, ["a", "b"]);

    assert.match(circularWarnings[0]!.message, /a -> b -> a/);
  });

  test("Detects a longer circular 'goto' reference", async () => {
    const source = `
node start
    goto :a
end
node a
    goto :b
end
node b
    goto :c
end
node c
    goto :a
end
`;
    const result = await prepareAnalysis(source);
    assert.strictEqual(result.warnings.length, 3);
    const nodesInWarning = result.warnings.map((w) => w.node).sort();
    assert.deepStrictEqual(nodesInWarning, ["a", "b", "c"]);
    assert.match(result.warnings[0]!.message, /a -> b -> c -> a/);
  });

  test("Does not flag choices that form a loop", async () => {
    const source = `
node start
    choice "Go to end", :end
end
node end
    choice "Go back to start", :start
end
`;
    const result = await prepareAnalysis(source);
    const circularWarnings = result.warnings.filter(
      (w) => w.type === "circular_reference",
    );
    assert.strictEqual(circularWarnings.length, 0);
  });

  test("Does not flag a self-referencing choice", async () => {
    const source = `
  node menu
      say "Choose an option."
      choice "Refresh menu", :menu
      choice "Exit", :end
  end
  node end
      say "Bye."
  end
  `;
    const result = await prepareAnalysis(source);
    const circularWarnings = result.warnings.filter(
      (w) => w.type === "circular_reference",
    );
    assert.strictEqual(circularWarnings.length, 0);
  });

  test("Detects a direct self-referencing goto loop", async () => {
    const source = `
  node looper
      @val += 1
      goto :looper
  end
  `;
    const result = await prepareAnalysis(source);
    assert.strictEqual(result.warnings.length, 1);
    assert.strictEqual(result.warnings[0]?.type, "circular_reference");
    assert.strictEqual(result.warnings[0]?.node, "looper");
  });
  test("Adds an error if 'start' node is missing", async () => {
    const source = `
  node beginning
    say "This is not the start node."
  end
  `;
    const result = await prepareAnalysis(source);
    assert.strictEqual(result.errors.length, 1, "Should have one error");

    const entryPointError = result.errors.find(
      (e) => e.type === "missing_entry_point",
    );
    assert.ok(entryPointError, "An entry point error should exist");
    assert.match(entryPointError?.message, /missing a 'start' node/);
    assert.strictEqual(result.valid, false);
  });

  test("Does not add an error if 'start' node is present", async () => {
    const source = `
  node other
      say "Some other node"
  end
  node start
      say "The adventure begins!"
  end
  `;
    const result = await prepareAnalysis(source);
    const entryPointError = result.errors.find(
      (e) => e.type === "missing_entry_point",
    );
    assert.strictEqual(
      entryPointError,
      undefined,
      "Should be no entry point error",
    );
  });

  test("Does not add an entry point error for an empty file", async () => {
    const source = `
  # This file is empty except for comments
  `;
    const result = await prepareAnalysis(source);
    const entryPointError = result.errors.find(
      (e) => e.type === "missing_entry_point",
    );
    assert.strictEqual(entryPointError, undefined);
  });
  test("Detects dead-end nodes", async () => {
    const source = `
  node start
    say "This is a dead end."
    @value = 10
  end
  `;
    const result = await prepareAnalysis(source);
    assert.strictEqual(result.warnings.length, 1, "Should have one warning");

    const deadEndWarning = result.warnings.find((w) => w.type === "dead_end");
    assert.ok(deadEndWarning, "A dead-end warning should exist");
    assert.strictEqual(deadEndWarning?.node, "start");
    assert.match(deadEndWarning?.message, /'start' is a dead end/);
  });
  test("Does not flag nodes with choices as dead ends", async () => {
    const source = `
  node start
      say "Please choose."
      choice "Option 1", :next
  end
  node next
      say "Thank you."
  end
  `;
    const result = await prepareAnalysis(source);
    // The 'next' node is a dead end, so we expect one warning.
    assert.strictEqual(result.warnings.length, 1);
    const deadEndWarning = result.warnings.find((w) => w.type === "dead_end");
    assert.strictEqual(deadEndWarning?.node, "next");
  });

  test("Does not flag nodes with goto as dead ends", async () => {
    const source = `
node start
  say "Redirecting..."
goto :next
end

node next
  say "You have arrived." # This is a dead end
end
  `;
    const result = await prepareAnalysis(source);
    assert.strictEqual(result.warnings.length, 1);
    const deadEndWarning = result.warnings.find((w) => w.type === "dead_end");
    assert.strictEqual(deadEndWarning?.node, "next");
  });

  test("Empty nodes are not considered dead ends (they are errors)", async () => {
    const source = `
  node start
  end
  `;
    const result = await prepareAnalysis(source);
    const deadEndWarning = result.warnings.find((w) => w.type === "dead_end");
    assert.strictEqual(
      deadEndWarning,
      undefined,
      "Empty nodes should not trigger dead-end warnings.",
    );
    assert.strictEqual(result.errors.length, 1); // It should still be an empty_node error
  });

  test("Detects undefined variable in a choice condition", async () => {
    const source = `
  node start
    choice "Check gold", :next, if: @gold > 50
  end
  node next
    say "..."
  end
  `;
    const result = await prepareAnalysis(source);
    const undefinedVarWarnings = result.warnings.filter(
      (w) => w.type === "undefined_variable",
    );
    assert.strictEqual(undefinedVarWarnings.length, 1);
    assert.strictEqual(undefinedVarWarnings[0]?.node, "start");
    assert.match(
      undefinedVarWarnings[0]!.message,
      /'@gold' is used but never assigned/,
    );
  });

  test("Detects undefined variable in a say interpolation", async () => {
    const source = `
  node start
      @gold = 100
      say "You have #{@platinum} platinum."
  end
  `;
    const result = await prepareAnalysis(source);
    const undefinedVarWarnings = result.warnings.filter(
      (w) => w.type === "undefined_variable",
    );
    assert.strictEqual(undefinedVarWarnings.length, 1);
    assert.match(undefinedVarWarnings[0]!.message, /'@platinum'/);
  });

  test("Detects a typo in a variable name", async () => {
    const source = `
  node start
      @gold = 100
      @gold += @gol
  end
  `;
    const result = await prepareAnalysis(source);
    const undefinedVarWarnings = result.warnings.filter(
      (w) => w.type === "undefined_variable",
    );
    assert.strictEqual(undefinedVarWarnings.length, 1);
    assert.match(undefinedVarWarnings[0]!.message, /'@gol'/);
  });

  test("Does not flag correctly defined and used variables", async () => {
    const source = `
  node start
      @gold = 50
      @has_key = false
      choice "Open door", :door, if: @has_key == true
      say "You have #{@gold} gold."
  end
  node door
      say "The door is locked."
  end
  `;
    const result = await prepareAnalysis(source);
    const undefinedVarWarnings = result.warnings.filter(
      (w) => w.type === "undefined_variable",
    );
    assert.strictEqual(undefinedVarWarnings.length, 0);
  });
  test("Detects an impossible condition that is always false", async () => {
    const source = `
  node start
    choice "This will never show", :next, if: false
  end
  node next
    say "..."
  end
  `;
    const result = await prepareAnalysis(source);
    const suspiciousWarnings = result.warnings.filter(
      (w) => w.type === "suspicious_condition",
    );
    assert.strictEqual(suspiciousWarnings.length, 1);
    assert.match(
      suspiciousWarnings[0]!.message,
      /condition for this choice is always false/,
    );
  });
  test("Detects impossible numerical comparisons", async () => {
    const source = `
  node start
      choice "Impossible", :next, if: 10 < 5
  end
  node next
      say "..."
  end
  `;
    const result = await prepareAnalysis(source);
    const suspiciousWarnings = result.warnings.filter(
      (w) => w.type === "suspicious_condition",
    );
    assert.strictEqual(suspiciousWarnings.length, 1);
  });

  test("Detects impossible boolean comparisons", async () => {
    const source = `
  node start
      choice "Never happens", :next, if: true == false
  end
  node next
      say "..."
  end
  `;
    const result = await prepareAnalysis(source);
    const suspiciousWarnings = result.warnings.filter(
      (w) => w.type === "suspicious_condition",
    );
    assert.strictEqual(suspiciousWarnings.length, 1);
  });

  test("Does not flag conditions with variables", async () => {
    const source = `
  node start
      @gold = 10
      choice "Maybe possible", :next, if: @gold < 5
  end
  node next
      say "..."
  end
  `;
    const result = await prepareAnalysis(source);
    const suspiciousWarnings = result.warnings.filter(
      (w) => w.type === "suspicious_condition",
    );
    assert.strictEqual(suspiciousWarnings.length, 0);
  });

  test("Does not flag conditions that are always true", async () => {
    const source = `
  node start
      choice "Always shows", :next, if: true
  end
  node next
      say "..."
  end
  `;
    const result = await prepareAnalysis(source);
    const suspiciousWarnings = result.warnings.filter(
      (w) => w.type === "suspicious_condition",
    );
    assert.strictEqual(suspiciousWarnings.length, 0);
  });

  test("Detects type mismatch when adding a number to a boolean", async () => {
    const source = `
  node start
    @has_key = true
    @result = 10 + @has_key
  end
  `;
    const result = await prepareAnalysis(source);
    const typeMismatchWarnings = result.warnings.filter(
      (w) => w.type === "type_mismatch",
    );
    assert.strictEqual(typeMismatchWarnings.length, 1);
    assert.match(
      typeMismatchWarnings[0]!.message,
      /Cannot apply operator '\+' to types 'number' and 'boolean'/,
    );
  });

  test("Detects type mismatch in a choice condition with logical AND", async () => {
    const source = `
  node start
      @gold = 100
      choice "Proceed", :next, if: @gold && true
  end
  node next
      say "..."
  end
  `;
    const result = await prepareAnalysis(source);
    const typeMismatchWarnings = result.warnings.filter(
      (w) => w.type === "type_mismatch",
    );
    assert.strictEqual(typeMismatchWarnings.length, 1);
    assert.match(
      typeMismatchWarnings[0]!.message,
      /Cannot apply operator '&&' to types 'number' and 'boolean'/,
    );
  });

  test("Does not flag valid operations with correct types", async () => {
    const source = `
  node start
      @gold = 100
      @cost = 50
      @can_afford = @gold >= @cost

      @has_key = true
      @is_open = false
      @can_enter = @has_key && !@is_open

      choice "Enter", :dungeon, if: @can_enter
  end
  node dungeon
      say "Welcome"
  end
  `;
    const result = await prepareAnalysis(source);
    const typeMismatchWarnings = result.warnings.filter(
      (w) => w.type === "type_mismatch",
    );
    assert.strictEqual(typeMismatchWarnings.length, 0);
  });

  test("Does not flag operations with unknown ('any') types", async () => {
    const source = `
  node start
      # @player_class is never defined, so its type is 'any'
      @strength = 10 + @player_class
  end
  `;
    const result = await prepareAnalysis(source);
    const typeMismatchWarnings = result.warnings.filter(
      (w) => w.type === "type_mismatch",
    );
    // We expect an 'undefined_variable' warning, but not a 'type_mismatch' one.
    assert.strictEqual(typeMismatchWarnings.length, 0);
    assert.strictEqual(
      result.warnings.some((w) => w.type === "undefined_variable"),
      true,
    );
  });

  test("Generates a suggestion for an unused variable", async () => {
    const source = `
  node start
    @unused_gold = 100
    say "Hello, world!"
  end
  `;
    const result = await prepareAnalysis(source);
    assert.ok(result.suggestions, "Result should have a suggestions array");
    assert.strictEqual(result?.suggestions?.length, 1);

    const suggestion = result?.suggestions?.[0];
    assert.strictEqual(suggestion?.type, "unused_variable");
    assert.match(
      suggestion?.message,
      /'@unused_gold' is assigned a value but is never used/,
    );
    assert.strictEqual(
      suggestion?.line,
      3,
      "Suggestion should point to the line of definition",
    );
  });

  test("Does not generate suggestions for variables that are used", async () => {
    const source = `
  node start
      @gold = 50
      choice "Proceed", :next, if: @gold > 20
  end
  node next
      say "..."
  end
  `;
    const result = await prepareAnalysis(source);
    assert.strictEqual(result.suggestions?.length, 0);
  });

  test("Generates suggestions for multiple unused variables", async () => {
    const source = `
  node start
      @gold = 100
      @has_key = false
      @mana = 50
      say "You have #{@gold} gold."
  end
  `;
    const result = await prepareAnalysis(source);
    assert.strictEqual(result.suggestions?.length, 2);

    const unusedNames = result?.suggestions
      ?.map((s) => s.message.match(/@(\w+)/)?.[1])
      .sort();
    assert.deepStrictEqual(unusedNames, ["has_key", "mana"]);
  });

  test("Unused variable suggestions do not make the analysis invalid", async () => {
    const source = `
  node start
      @unused = true
  end
  `;
    const result = await prepareAnalysis(source);
    assert.strictEqual(result.suggestions?.length, 1);
    assert.strictEqual(result.errors.length, 0);
    assert.strictEqual(result.valid, true);
  });

  test("Detects identical choice text within the same node", async () => {
    const source = `
  node start
      say "What do you do?"
      choice "Attack the goblin", :fight
      choice "Talk to the goblin", :talk
      choice "Attack the goblin", :fight_again
  end
  node fight
  end
  node talk
  end
  node fight_again
  end
  `;
    const result = await prepareAnalysis(source);
    const identicalChoiceWarnings = result.warnings.filter(
      (w) => w.type === "identical_choice",
    );
    assert.strictEqual(identicalChoiceWarnings.length, 1);
    assert.match(
      identicalChoiceWarnings[0]!.message,
      /duplicate choices with the text: "Attack the goblin"/,
    );
    assert.strictEqual(
      identicalChoiceWarnings[0]!.line,
      6,
      "Warning should be on the second instance",
    );
  });

  test("Does not flag choices with different text", async () => {
    const source = `
  node start
      choice "Go left", :left
      choice "Go right", :right
  end
  node left
  end
  node right
  end
  `;
    const result = await prepareAnalysis(source);
    const identicalChoiceWarnings = result.warnings.filter(
      (w) => w.type === "identical_choice",
    );
    assert.strictEqual(identicalChoiceWarnings.length, 0);
  });

  test("Does not flag identical choices in different nodes", async () => {
    const source = `
  node start
      choice "Leave", :exit
  end
  node another_place
      choice "Leave", :exit
  end
  node exit
  end
  `;
    const result = await prepareAnalysis(source);
    const identicalChoiceWarnings = result.warnings.filter(
      (w) => w.type === "identical_choice",
    );
    assert.strictEqual(identicalChoiceWarnings.length, 0);
  });
});
