/**
 * Example: Using CodeMirror 6 + Tree-sitter Adapter with Tome language
 */

import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { treeSitter, createTreeSitterParser, getTree } from "./codemirrorTSAdapter";

// Tome-specific highlight query
const TOME_HIGHLIGHT_QUERY = `
  ; Keywords
  ["node" "say" "choice" "goto" "if" "end"] @keyword

  ; Literals
  (number_literal) @number
  (string_literal) @string
  (boolean_literal) @constant.builtin

  ; Variables
  (variable) @variable

  ; Function calls
  (function_call
    name: (identifier) @function)

  ; Operators
  ["=" "+=" "-=" "*=" "/="] @operator
  ["+" "-" "*" "/"] @operator
  ["==" "!=" ">" ">=" "<" "<="] @operator
  ["&&" "||" "!"] @operator

  ; Punctuation
  [":" "," "(" ")" "@"] @punctuation

  ; Node identifiers
  (node_definition
    name: (identifier) @type)

  ; Node references
  (node_reference
    target: (identifier) @type)

  ; Comments
  (comment) @comment

  ; String interpolation
  (interpolation) @embedded
`;

// Custom color scheme for Tome (VS Code Dark+ inspired)
const TOME_COLOR_MAP = {
  keyword: "#C586C0",
  number: "#B5CEA8",
  string: "#CE9178",
  "constant.builtin": "#4EC9B0",
  variable: "#9CDCFE",
  function: "#DCDCAA",
  operator: "#D4D4D4",
  punctuation: "#D4D4D4",
  type: "#4EC9B0",
  comment: "#6A9955",
  embedded: "#569CD6",
};

/**
 * Initialize Tome editor with tree-sitter support
 */
export async function createTomeEditor(
  parent: HTMLElement,
  TreeSitter: any,
  initialDoc = "",
): Promise<EditorView> {
  // Create the parser
  const parser = await createTreeSitterParser(
    TreeSitter,
    "tree-sitter-tome.wasm",
  );

  // Create the editor state with extensions
  const state = EditorState.create({
    doc: initialDoc,
    extensions: [
      basicSetup,
      treeSitter({
        parser,
        highlightQuery: TOME_HIGHLIGHT_QUERY,
        colorMap: TOME_COLOR_MAP,
        onParse: (tree, duration) => {
          console.log(`Parsed in ${duration.toFixed(1)}ms`);
          if (tree.rootNode.hasError) {
            console.warn("Parse tree contains errors");
          }
        },
      }),
    ],
  });

  // Create the editor view
  const view = new EditorView({
    state,
    parent,
  });

  return view;
}

/**
 * Example: Using CSS classes instead of inline styles
 */
export async function createTomeEditorWithCssClasses(
  parent: HTMLElement,
  TreeSitter: any,
  initialDoc = "",
): Promise<EditorView> {
  const parser = await createTreeSitterParser(
    TreeSitter,
    "tree-sitter-tome.wasm",
  );

  const state = EditorState.create({
    doc: initialDoc,
    extensions: [
      basicSetup,
      treeSitter({
        parser,
        highlightQuery: TOME_HIGHLIGHT_QUERY,
        useCssClasses: true,
        cssPrefix: "tome-",
      }),
    ],
  });

  return new EditorView({ state, parent });
}

/**
 * CSS for class-based highlighting
 */
export const TOME_CSS = `
  .tome-keyword { color: #C586C0; font-weight: bold; }
  .tome-number { color: #B5CEA8; }
  .tome-string { color: #CE9178; }
  .tome-constant { color: #4EC9B0; }
  .tome-variable { color: #9CDCFE; }
  .tome-function { color: #DCDCAA; }
  .tome-operator { color: #D4D4D4; }
  .tome-punctuation { color: #D4D4D4; }
  .tome-type { color: #4EC9B0; font-weight: bold; }
  .tome-comment { color: #6A9955; font-style: italic; }
  .tome-embedded { color: #569CD6; }
`;

/**
 * Example: Complete HTML page
 */
export function generateExampleHtml(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tome Editor - CodeMirror 6 + Tree-sitter</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      background: #1e1e1e;
      color: #d4d4d4;
    }

    h1 {
      margin-bottom: 10px;
    }

    #editor-container {
      border: 1px solid #3c3c3c;
      border-radius: 4px;
      overflow: hidden;
    }

    #status {
      margin-top: 10px;
      padding: 8px;
      background: #252526;
      border-radius: 4px;
      font-size: 12px;
      font-family: monospace;
    }

    .cm-editor {
      height: 500px;
    }

    .cm-scroller {
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 14px;
    }

    ${TOME_CSS}
  </style>
</head>
<body>
  <h1>Tome Editor</h1>
  <p>CodeMirror 6 with Tree-sitter syntax highlighting</p>

  <div id="editor-container"></div>
  <div id="status">Initializing...</div>

  <script src="tree-sitter.js"></script>
  <script type="module">
    import { EditorView, basicSetup } from "https://esm.sh/codemirror@6";
    import { EditorState } from "https://esm.sh/@codemirror/state@6";
    import { treeSitter, createTreeSitterParser } from "./codemirrorTSAdapter.js";

    const TOME_HIGHLIGHT_QUERY = \`
      ["node" "say" "choice" "goto" "if" "end"] @keyword
      (number_literal) @number
      (string_literal) @string
      (boolean_literal) @constant.builtin
      (variable) @variable
      (function_call name: (identifier) @function)
      ["=" "+=" "-=" "*=" "/="] @operator
      ["+" "-" "*" "/"] @operator
      ["==" "!=" ">" ">=" "<" "<="] @operator
      ["&&" "||" "!"] @operator
      [":" "," "(" ")" "@"] @punctuation
      (node_definition name: (identifier) @type)
      (node_reference target: (identifier) @type)
      (comment) @comment
      (interpolation) @embedded
    \`;

    const initialCode = \`node start
  say "Welcome to the adventure!"
  say "You have #{@gold} gold."

  @visited_start = true

  choice "Go to shop", :shop
  choice "Go to forest", :forest, if: @level >= 5
  choice "Quit", :ending
end

node shop
  say "Welcome to my shop!"
  choice "Back", :start
end

node forest
  say "You enter the forest..."
  goto :start
end

node ending
  say "Thanks for playing!"
end
\`;

    async function init() {
      const parser = await createTreeSitterParser(
        window.TreeSitter,
        "tree-sitter-tome.wasm"
      );

      const statusEl = document.getElementById("status");
      let parseCount = 0;

      const state = EditorState.create({
        doc: initialCode,
        extensions: [
          basicSetup,
          treeSitter({
            parser,
            highlightQuery: TOME_HIGHLIGHT_QUERY,
            useCssClasses: true,
            cssPrefix: "tome-",
            onParse: (tree, duration) => {
              parseCount++;
              const hasErrors = tree.rootNode.hasError;
              statusEl.textContent = \`Parse #\${parseCount}: \${duration.toFixed(1)}ms \${hasErrors ? '⚠️ Errors' : '✓ OK'}\`;
              statusEl.style.color = hasErrors ? '#f48771' : '#73c991';
            },
          }),
        ],
      });

      new EditorView({
        state,
        parent: document.getElementById("editor-container"),
      });

      statusEl.textContent = "Editor ready!";
      statusEl.style.color = '#73c991';
    }

    init().catch(err => {
      document.getElementById("status").textContent = \`Error: \${err.message}\`;
      document.getElementById("status").style.color = '#f48771';
    });
  </script>
</body>
</html>
  `;
}

/**
 * Example: Get diagnostics from parse tree
 */
export function getDiagnostics(view: EditorView): Array<{ message: string; from: number; to: number }> {
  const tree = getTree(view);
  if (!tree) return [];

  const diagnostics: Array<{ message: string; from: number; to: number }> = [];

  function walk(node: any) {
    if (node.type === "ERROR" || node.isMissing) {
      diagnostics.push({
        message: node.isMissing ? `Missing ${node.type}` : "Syntax error",
        from: node.startIndex,
        to: node.endIndex,
      });
    }

    for (const child of node.children) {
      walk(child);
    }
  }

  walk(tree.rootNode);
  return diagnostics;
}

/**
 * Example: Auto-save to localStorage
 */
export function setupAutoSave(view: EditorView, key = "tome-code") {
  let saveTimer: number;

  // Save on document changes
  EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => {
        localStorage.setItem(key, view.state.doc.toString());
      }, 2000);
    }
  });

  // Load saved content
  const saved = localStorage.getItem(key);
  if (saved) {
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: saved },
    });
  }
}
