# CodeMirror Tree-sitter Adapter

A general-purpose adapter for integrating any tree-sitter grammar with CodeMirror for syntax highlighting and incremental parsing.

## Features

- ✅ **Incremental parsing** - Only re-parses changed sections
- ✅ **Syntax highlighting** - Uses tree-sitter queries for accurate highlighting
- ✅ **Grammar-agnostic** - Works with any `.wasm` tree-sitter grammar
- ✅ **Debounced updates** - Configurable debouncing for performance
- ✅ **Flexible styling** - Supports inline styles or CSS classes
- ✅ **Parse callbacks** - Hook into parse events for custom behavior

## Installation

```bash
# Install dependencies
npm install codemirror web-tree-sitter
```

Include the tree-sitter runtime in your HTML:

```html
<script src="tree-sitter.js"></script>
```

## Basic Usage

```typescript
import { CodeMirrorTreeSitterAdapter } from './editor/codemirrorTSAdapter';

// Create CodeMirror instance
const editor = CodeMirror.fromTextArea(textareaElement, {
  lineNumbers: true,
  showCursorWhenSelecting: true,
});

// Create adapter with your grammar
const adapter = new CodeMirrorTreeSitterAdapter(
  editor,
  {
    grammarPath: 'tree-sitter-mylang.wasm',
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
  }
);

// Initialize
await adapter.initialize(window.TreeSitter);
```

## API Reference

### `CodeMirrorTreeSitterAdapter`

#### Constructor

```typescript
constructor(
  editor: CodeMirror.Editor,
  config: TreeSitterConfig,
  highlightConfig?: TreeSitterHighlightConfig
)
```

**TreeSitterConfig:**
- `grammarPath: string` - Path to `.wasm` grammar file
- `highlightQuery: string` - Tree-sitter query for syntax highlighting
- `colorMap?: Record<string, string>` - Custom colors for capture names
- `parseDebounceMs?: number` - Parse debounce delay (default: 50ms)
- `highlightDebounceMs?: number` - Highlight debounce delay (default: 50ms)

**TreeSitterHighlightConfig:**
- `colors?: string[]` - Custom color palette (default: built-in colors)
- `useCssClasses?: boolean` - Use CSS classes instead of inline styles (default: false)
- `cssPrefix?: string` - CSS class prefix (default: 'ts-')

#### Methods

**`async initialize(TreeSitter: any): Promise<void>`**

Initialize tree-sitter and set up the parser.

**`onParse(callback: (tree: Tree, duration: number) => void): void`**

Register a callback to be invoked after each parse.

```typescript
adapter.onParse((tree, duration) => {
  console.log(`Parsed in ${duration.toFixed(1)}ms`);
  if (tree.rootNode.hasError) {
    console.warn('Parse errors detected');
  }
});
```

**`getTree(): Tree | null`**

Get the current parse tree.

**`getParser(): Parser | null`**

Get the tree-sitter parser instance.

**`async reparse(): Promise<void>`**

Manually trigger a re-parse.

**`rehighlight(): void`**

Manually trigger re-highlighting.

**`dispose(): void`**

Clean up resources and remove event listeners.

## Examples

### Example 1: Using with Tome Language

```typescript
import { CodeMirrorTreeSitterAdapter } from './editor/codemirrorTSAdapter';

const tomeQuery = `
  ["node" "say" "choice" "goto"] @keyword
  (number_literal) @number
  (string_literal) @string
  (variable) @variable
  (comment) @comment
`;

const adapter = new CodeMirrorTreeSitterAdapter(editor, {
  grammarPath: 'tree-sitter-tome.wasm',
  highlightQuery: tomeQuery,
  colorMap: {
    keyword: '#C586C0',
    number: '#B5CEA8',
    string: '#CE9178',
    variable: '#9CDCFE',
    comment: '#6A9955',
  },
});

await adapter.initialize(window.TreeSitter);
```

### Example 2: Using CSS Classes

```typescript
const adapter = new CodeMirrorTreeSitterAdapter(
  editor,
  {
    grammarPath: 'tree-sitter-python.wasm',
    highlightQuery: pythonQuery,
  },
  {
    useCssClasses: true,
    cssPrefix: 'py-',
  }
);

await adapter.initialize(window.TreeSitter);
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
const statusElement = document.getElementById('status');

adapter.onParse((tree, duration) => {
  parseCount++;
  statusElement.textContent =
    `Parse #${parseCount} completed in ${duration.toFixed(1)}ms`;

  // Check for errors
  if (tree.rootNode.hasError) {
    statusElement.style.color = 'red';
  } else {
    statusElement.style.color = 'green';
  }
});
```

## Writing Highlight Queries

Tree-sitter queries use a pattern-matching syntax. Here's a quick guide:

```scheme
; Match specific node types
(keyword) @keyword
(string) @string

; Match with fields
(function_call
  name: (identifier) @function)

; Match multiple types
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

**Strings:**
```scheme
(string_literal) @string
(interpolation) @embedded
```

## Performance Tips

1. **Adjust debounce delays** based on grammar complexity
2. **Use CSS classes** for large files (avoids creating many inline style nodes)
3. **Limit viewport highlighting** - The adapter only highlights visible lines
4. **Monitor parse times** with the `onParse` callback

## Browser Support

Requires:
- Modern browser with WebAssembly support
- CodeMirror 5.x or 6.x
- web-tree-sitter

## License

Same as parent project.
