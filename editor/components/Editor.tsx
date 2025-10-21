import { EditorState } from "@codemirror/state";
import { EditorView, basicSetup } from "codemirror";
import { defaultKeymap } from "@codemirror/commands";
import { keymap } from "@codemirror/view";
import { catppuccinMocha } from "@catppuccin/codemirror";
import { useEffect, useRef } from "react";
import { text } from "./EditorDefaultText.ts";
import { createTreeSitterParser, treeSitter } from "../codemirrorTSAdapter.ts";
import Parser from "web-tree-sitter";
export default function Editor() {
  const ref = useRef(null);
  const setupEditor = async () => {
    console.log("[Editor] Starting editor setup");
    console.log("[Editor] Parser module:", Parser);

    const tome = await createTreeSitterParser(Parser, "tree-sitter-tome.wasm");
    console.log("[Editor] Tome parser created:", tome);

    const highlightQuery = `
; Keywords
([
    "node"
    "end"
    "say"
    "choice"
    "goto"
    "if"
] @keyword)

; Operators
([
    "="
    "+="
    "-="
    "*="
    "/="
    "!"
    "*"
    "/"
    "+"
    "-"
    "=="
    "!="
    ">"
    ">="
    "<"
    "<="
    "&&"
    "||"
] @operator)

; Punctuation
([
    ","
    ":"
    "("
    ")"
] @punctuation.bracket)

(interpolation
  (interpolation_start) @punctuation.special
  (expression) @embedded                   ; <-- Moved this up
  (interpolation_end) @punctuation.special   ; <-- Moved this down
)

; Literals
(string_literal) @string
(number_literal) @number
(boolean_literal) @boolean
(escape_sequence) @string.escape

; Variables
(variable
  "@" @operator
  (identifier) @variable)

; Function calls
(function_call
  name: (identifier) @function)

; Comments
(comment) @comment

; Node definitions and references
(node_definition
  name: (identifier) @constructor)

(node_reference
  target: (identifier) @constructor)
`;

    console.log("[Editor] Highlight query defined, length:", highlightQuery.length);
    console.log("[Editor] Query content:", highlightQuery);

    const colorMap = {
      keyword: "#C586C0",
      string: "#CE9178",
      number: "#B5CEA8",
      comment: "#6A9955",
    };
    console.log("[Editor] Color map:", colorMap);

    console.log("[Editor] Creating editor state with extensions...");

    const startState = EditorState.create({
      doc: text,
      extensions: [
        basicSetup,
        keymap.of(defaultKeymap),
        catppuccinMocha,
        treeSitter({
          parser: tome,
          highlightQuery,
          colorMap,
          onParse: (tree, duration) => {
            console.log(`[Editor] onParse callback: ${duration.toFixed(2)}ms, hasError: ${tree.rootNode.hasError}`);
          },
        }),
      ],
    });

    console.log("[Editor] Editor state created, creating view...");

    const view = new EditorView({
      state: startState,
      parent: ref.current,
    });

    console.log("[Editor] Editor view created successfully!");
    console.log("[Editor] View state:", view.state);
  };
  useEffect(() => {
    console.log("[Editor] useEffect running, ref.current:", ref.current);
    if (!ref.current) {
      console.warn("[Editor] ref.current is null, skipping setup");
      return;
    }

    setupEditor().catch((error) => {
      console.error("[Editor] Setup failed:", error);
      console.error("[Editor] Error stack:", error.stack);
    });

    return () => {
      console.log("[Editor] Cleanup running");
    };
  }, []);
  return <div ref={ref}></div>;
}
