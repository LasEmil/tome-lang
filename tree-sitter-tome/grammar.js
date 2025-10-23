/// <reference types="tree-sitter-cli/dsl" />
// @ts-check
const PREC = {
  OR: 1,
  AND: 2,
  COMPARE: 3,
  TERM: 4,
  FACTOR: 5,
  UNARY: 6,
};
export default grammar({
  name: "tome",
  extras: ($) => [/[ \t]/, $._newline, $.comment],
  externals: ($) => [
    $._string_content,
    $.interpolation_start,
    $.interpolation_end,
  ],
  rules: {
    source_file: ($) => repeat($.node_definition),
    node_definition: ($) =>
      seq(
        "node",
        field("name", $.identifier),
        $._newline,
        field("body", optional($._node_body)),
        "end",
      ),
    _node_body: ($) =>
      repeat1(choice(seq($._statement, $._newline), $._newline)),
    _statement: ($) =>
      choice(
        $.assignment_statement,
        $.say_statement,
        $.choice_statement,
        $.goto_statement,
      ),
    assignment_statement: ($) =>
      seq(
        $.variable,
        field("operator", choice("=", "+=", "-=", "*=", "/=")),
        $.expression,
      ),
    say_statement: ($) => seq("say", $.string_literal),
    choice_statement: ($) =>
      seq(
        "choice",
        field("text", $.string_literal),
        ",",
        $.node_reference,
        optional($.condition_clause),
      ),
    node_reference: ($) => seq(":", field("target", $.identifier)),
    condition_clause: ($) =>
      seq(",", "if", ":", field("condition", $.expression)),
    goto_statement: ($) => seq("goto", $.node_reference),
    expression: ($) =>
      choice(
        $.primary_expression,
        prec.right(
          PREC.UNARY,
          seq(
            field("operator", choice("!", "-")),
            field("operand", $.expression),
          ),
        ),
        prec.left(
          PREC.FACTOR,
          seq(
            field("left", $.expression),
            field("operator", choice("*", "/")),
            field("right", $.expression),
          ),
        ),
        prec.left(
          PREC.TERM,
          seq(
            field("left", $.expression),
            field("operator", choice("+", "-")),
            field("right", $.expression),
          ),
        ),
        prec.left(
          PREC.COMPARE,
          seq(
            field("left", $.expression),
            field("operator", choice("==", "!=", ">", ">=", "<", "<=")),
            field("right", $.expression),
          ),
        ),
        prec.left(
          PREC.AND,
          seq(
            field("left", $.expression),
            field("operator", "&&"),
            field("right", $.expression),
          ),
        ),
        prec.left(
          PREC.OR,
          seq(
            field("left", $.expression),
            field("operator", "||"),
            field("right", $.expression),
          ),
        ),
      ),
    primary_expression: ($) =>
      choice(
        $.literal,
        $.variable,
        $.function_call,
        seq("(", $.expression, ")"),
      ),
    literal: ($) =>
      choice($.number_literal, $.string_literal, $.boolean_literal),
    boolean_literal: (_) => choice("true", "false"),
    number_literal: (_) => /\d+(\.\d+)?/,
    string_literal: ($) =>
      seq(
        '"',
        repeat(choice($._string_content, $.interpolation, $.escape_sequence)),
        '"',
      ),
    interpolation: ($) =>
      seq($.interpolation_start, $.expression, $.interpolation_end),
    escape_sequence: (_) => token.immediate(/\\./),
    variable: ($) => seq("@", $.identifier),
    function_call: ($) =>
      seq(
        field("name", $.identifier),
        "(",
        optional(sepBy1(",", $.expression)),
        ")",
      ),
    identifier: (_) => /[a-zA-Z_][a-zA-Z0-9_]*/,
    _newline: (_) => /[\r\n]+/,
    comment: (_) => token(seq("#", /.*/)),
  },
});
function sepBy1(sep, rule) {
  return seq(rule, repeat(seq(sep, rule)));
}
function sepBy(sep, rule) {
  return optional(sepBy1(sep, rule));
}
