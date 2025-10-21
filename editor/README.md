# CodeMirror 6 + Tree-sitter Adapter

A general-purpose adapter for integrating any tree-sitter grammar with CodeMirror 6 for syntax highlighting and incremental parsing.

## Features

- ✅ **Incremental parsing** - Only re-parses changed sections
- ✅ **Syntax highlighting** - Uses tree-sitter queries for accurate highlighting
- ✅ **Grammar-agnostic** - Works with any `.wasm` tree-sitter grammar
- ✅ **Modern architecture** - Built on CodeMirror 6's extension system
- ✅ **Viewport-aware** - Only highlights visible lines for performance
- ✅ **Flexible styling** - Supports inline styles or CSS classes
- ✅ **Parse callbacks** - Hook into parse events for custom behavior

## Installation

```bash
npm install codemirror @codemirror/state @codemirror/view web-tree-sitter
```

## Basic Usage

```typescript
import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { treeSitter, createTreeSitterParser } from './editor/codemirrorTSAdapter';

// Create parser
const parser = await createTreeSitterParser(
  window.TreeSitter,
  'tree-sitter-mylang.wasm'
);

// Create editor with tree-sitter extension
const view = new EditorView({
  state: EditorState.create({
    doc: 'your code here',
    extensions: [
      basicSetup,
      treeSitter({
        parser,
        highlightQuery: `
          (keyword) @keyword
          (string) @string
          (number) @number
          (comment) @comment
        `,
        colorMap: {
          keyword: '#C586C0',
          string: '#CE9178',
          number: '#B5CEA8',
          comment: '#6A9955',
        },
      }),
    ],
  }),
  parent: document.getElementById('editor'),
});
```

## API Reference

### Functions

#### `treeSitter(config: TreeSitterConfig): Extension`

Creates a CodeMirror 6 extension for tree-sitter integration.

**TreeSitterConfig:**
```typescript
{
  parser: Parser;              // Tree-sitter parser instance
  highlightQuery: string;      // Tree-sitter highlight query
  colorMap?: Record<string, string>;  // Custom colors for captures
  useCssClasses?: boolean;     // Use CSS classes (default: false)
  cssPrefix?: string;          // CSS class prefix (default: 'ts-')
  onParse?: (tree, duration) => void;  // Parse callback
}
```

#### `createTreeSitterParser(TreeSitter: any, grammarPath: string): Promise<Parser>`

Helper to create and initialize a tree-sitter parser.

```typescript
const parser = await createTreeSitterParser(
  window.TreeSitter,
  'path/to/grammar.wasm'
);
```

#### `getTree(view: EditorView): Parser.Tree | null`

Get the current parse tree from an editor instance.

```typescript
const tree = getTree(view);
if (tree && tree.rootNode.hasError) {
  console.log('Parse errors detected');
}
```

## Examples

### Example 1: Complete Tome Editor

```typescript
import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { treeSitter, createTreeSitterParser } from './codemirrorTSAdapter';

async function createTomeEditor(parent: HTMLElement) {
  const parser = await createTreeSitterParser(
    window.TreeSitter,
    'tree-sitter-tome.wasm'
  );

  const view = new EditorView({
    state: EditorState.create({
      extensions: [
        basicSetup,
        treeSitter({
          parser,
          highlightQuery: `
            ["node" "say" "choice" "goto"] @keyword
            (number_literal) @number
            (string_literal) @string
            (variable) @variable
            (comment) @comment
          `,
          colorMap: {
            keyword: '#C586C0',
            number: '#B5CEA8',
            string: '#CE9178',
            variable: '#9CDCFE',
            comment: '#6A9955',
          },
          onParse: (tree, duration) => {
            console.log(`Parsed in ${duration.toFixed(1)}ms`);
          },
        }),
      ],
    }),
    parent,
  });

  return view;
}
```

### Example 2: Using CSS Classes

```typescript
const view = new EditorView({
  state: EditorState.create({
    extensions: [
      basicSetup,
      treeSitter({
        parser,
        highlightQuery: pythonQuery,
        useCssClasses: true,
        cssPrefix: 'py-',
      }),
    ],
  }),
  parent,
});
```

Then in your CSS:

```css
.py-keyword { color: #C586C0; font-weight: bold; }
.py-string { color: #CE9178; }
.py-number { color: #B5CEA8; }
.py-comment { color: #6A9955; font-style: italic; }
```

### Example 3: Parse Event Monitoring

```typescript
let parseCount = 0;
const statusEl = document.getElementById('status');

treeSitter({
  parser,
  highlightQuery,
  onParse: (tree, duration) => {
    parseCount++;
    statusEl.textContent = `Parse #${parseCount}: ${duration.toFixed(1)}ms`;

    if (tree.rootNode.hasError) {
      statusEl.style.color = 'red';
    } else {
      statusEl.style.color = 'green';
    }
  },
})
```

### Example 4: Getting Diagnostics

```typescript
import { getTree } from './codemirrorTSAdapter';

function getDiagnostics(view: EditorView) {
  const tree = getTree(view);
  if (!tree) return [];

  const diagnostics = [];

  function walk(node) {
    if (node.type === 'ERROR' || node.isMissing) {
      diagnostics.push({
        message: node.isMissing ? `Missing ${node.type}` : 'Syntax error',
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
```

## Writing Highlight Queries

Tree-sitter queries use a Lisp-like syntax for pattern matching:

```scheme
; Match specific node types
(keyword) @keyword
(string) @string

; Match with fields
(function_call
  name: (identifier) @function)

; Match multiple alternatives
[
  "if"
  "else"
  "while"
] @keyword

; Match operators
["+" "-" "*" "/"] @operator

; Nested patterns
(binary_expression
  operator: _ @operator)
```

### Common Patterns

**Keywords:**
```scheme
["if" "else" "while" "for" "return"] @keyword
```

**Function calls:**
```scheme
(function_call
  name: (identifier) @function)
```

**Variables:**
```scheme
(variable) @variable
(identifier) @variable
```

**Comments:**
```scheme
(comment) @comment
(line_comment) @comment
(block_comment) @comment
```

**Strings with interpolation:**
```scheme
(string_literal) @string
(interpolation) @embedded
```

## CodeMirror 6 Architecture

This adapter leverages CodeMirror 6's modern architecture:

- **StateField** - Stores the current parse tree in editor state
- **ViewPlugin** - Manages parsing and decoration updates
- **Decorations** - Applies syntax highlighting via marks
- **Effects** - Updates state when tree changes
- **Extensions** - Modular composition of features

## Performance

The adapter is optimized for performance:

1. **Incremental parsing** - Tree-sitter only re-parses changed sections
2. **Viewport-aware** - Only highlights visible lines
3. **Debounced updates** - Highlights update on viewport changes
4. **Efficient decorations** - Uses RangeSetBuilder for fast decoration updates

## Browser Support

Requires:
- Modern browser with WebAssembly support
- ES2020+ (for optional chaining, nullish coalescing)
- CodeMirror 6.x
- web-tree-sitter

## Migration from CodeMirror 5

Key differences from CodeMirror 5:

| CodeMirror 5 | CodeMirror 6 |
|--------------|--------------|
| `editor.markText()` | `Decoration.mark()` |
| Options object | Extensions array |
| Imperative API | Functional updates |
| `editor.on('changes')` | `ViewPlugin.update()` |
| `editor.getValue()` | `view.state.doc.toString()` |

## License

Same as parent project.
