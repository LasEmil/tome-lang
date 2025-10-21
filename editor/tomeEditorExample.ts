/**
 * Example: Using CodeMirrorTreeSitterAdapter with Tome language
 *
 * This shows how to integrate the tree-sitter adapter with CodeMirror
 * for the Tome dialogue language.
 */

import { CodeMirrorTreeSitterAdapter } from "./codemirrorTSAdapter";

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

// Custom color scheme for Tome
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
export async function initializeTomeEditor(
  editorElement: HTMLTextAreaElement,
  TreeSitter: any,
): Promise<CodeMirrorTreeSitterAdapter> {
  // Create CodeMirror editor
  const editor = (window as any).CodeMirror.fromTextArea(editorElement, {
    lineNumbers: true,
    showCursorWhenSelecting: true,
    mode: "tome", // Optional: if you have a basic CodeMirror mode
    theme: "default",
  });

  // Create tree-sitter adapter
  const adapter = new CodeMirrorTreeSitterAdapter(
    editor,
    {
      grammarPath: "tree-sitter-tome.wasm",
      highlightQuery: TOME_HIGHLIGHT_QUERY,
      colorMap: TOME_COLOR_MAP,
      parseDebounceMs: 50,
      highlightDebounceMs: 50,
    },
    {
      useCssClasses: false, // Use inline styles for simplicity
    },
  );

  // Optional: Listen to parse events
  adapter.onParse((tree, duration) => {
    console.log(`Parsed in ${duration.toFixed(1)}ms`);

    // You can also check for errors
    if (tree.rootNode.hasError) {
      console.warn("Parse tree contains errors");
    }
  });

  // Initialize the adapter
  await adapter.initialize(TreeSitter);

  return adapter;
}

/**
 * Example: Browser usage
 */
export function exampleBrowserUsage() {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Tome Editor</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/codemirror.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/codemirror.min.js"></script>
  <script src="tree-sitter.js"></script>
</head>
<body>
  <textarea id="tome-editor">
node start
  say "Welcome to the adventure!"

  choice "Begin", :game
  choice "Quit", :end
end

node game
  say "The adventure begins..."
  goto :end
end

node end
  say "Thanks for playing!"
end
  </textarea>

  <script type="module">
    import { initializeTomeEditor } from './tomeEditorExample.js';

    const editorElement = document.getElementById('tome-editor');
    const adapter = await initializeTomeEditor(editorElement, window.TreeSitter);

    // Optional: Add save/load functionality
    function saveCode() {
      localStorage.setItem('tomeCode', adapter.getTree().rootNode.text);
    }

    function loadCode() {
      const saved = localStorage.getItem('tomeCode');
      if (saved) {
        editorElement.value = saved;
        adapter.reparse();
      }
    }

    // Auto-save on changes
    let saveTimer;
    adapter.onParse(() => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveCode, 2000);
    });

    loadCode();
  </script>
</body>
</html>
  `;

  return html;
}

/**
 * Example: CSS classes usage (alternative to inline styles)
 */
export async function initializeTomeEditorWithCssClasses(
  editorElement: HTMLTextAreaElement,
  TreeSitter: any,
): Promise<CodeMirrorTreeSitterAdapter> {
  const editor = (window as any).CodeMirror.fromTextArea(editorElement, {
    lineNumbers: true,
    showCursorWhenSelecting: true,
  });

  const adapter = new CodeMirrorTreeSitterAdapter(
    editor,
    {
      grammarPath: "tree-sitter-tome.wasm",
      highlightQuery: TOME_HIGHLIGHT_QUERY,
      parseDebounceMs: 50,
      highlightDebounceMs: 50,
    },
    {
      useCssClasses: true,
      cssPrefix: "tome-",
    },
  );

  await adapter.initialize(TreeSitter);

  return adapter;
}

/**
 * Corresponding CSS for class-based highlighting
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
