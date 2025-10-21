/**
 * CodeMirror + Tree-sitter Adapter
 *
 * A general-purpose adapter that integrates any tree-sitter grammar
 * with CodeMirror for syntax highlighting and parsing.
 */

import type Parser from "web-tree-sitter";

export interface TreeSitterConfig {
  /** Path to the .wasm grammar file */
  grammarPath: string;

  /** Tree-sitter query for syntax highlighting */
  highlightQuery: string;

  /** Optional color map for captures (defaults to built-in colors) */
  colorMap?: Record<string, string>;

  /** Debounce delay for parse updates (ms) */
  parseDebounceMs?: number;

  /** Debounce delay for highlight updates (ms) */
  highlightDebounceMs?: number;
}

export interface TreeSitterHighlightConfig {
  /** Custom colors for specific capture names */
  colors?: string[];

  /** Whether to use CSS classes instead of inline styles */
  useCssClasses?: boolean;

  /** CSS class prefix when useCssClasses is true */
  cssPrefix?: string;
}

export class CodeMirrorTreeSitterAdapter {
  private parser: Parser | null = null;
  private tree: Parser.Tree | null = null;
  private query: Parser.Query | null = null;
  private editor: any; // CodeMirror.Editor
  private parseCount = 0;

  private config: Required<TreeSitterConfig>;
  private highlightConfig: TreeSitterHighlightConfig;

  private parseDebounceTimer: number | null = null;
  private highlightDebounceTimer: number | null = null;

  private onParseCallback?: (tree: Parser.Tree, duration: number) => void;

  // Default color palette for syntax highlighting
  private static DEFAULT_COLORS = [
    'blue',
    'chocolate',
    'darkblue',
    'darkcyan',
    'darkgreen',
    'darkred',
    'darkslategray',
    'dimgray',
    'green',
    'indigo',
    'navy',
    'red',
    'sienna',
  ];

  constructor(
    editor: any,
    config: TreeSitterConfig,
    highlightConfig: TreeSitterHighlightConfig = {},
  ) {
    this.editor = editor;
    this.config = {
      grammarPath: config.grammarPath,
      highlightQuery: config.highlightQuery,
      colorMap: config.colorMap || {},
      parseDebounceMs: config.parseDebounceMs ?? 50,
      highlightDebounceMs: config.highlightDebounceMs ?? 50,
    };
    this.highlightConfig = {
      colors: highlightConfig.colors || CodeMirrorTreeSitterAdapter.DEFAULT_COLORS,
      useCssClasses: highlightConfig.useCssClasses ?? false,
      cssPrefix: highlightConfig.cssPrefix ?? 'ts-',
    };
  }

  /**
   * Initialize tree-sitter and set up the parser with the specified grammar
   */
  async initialize(TreeSitter: any): Promise<void> {
    await TreeSitter.init();

    this.parser = new TreeSitter();
    const language = await TreeSitter.Language.load(this.config.grammarPath);
    this.parser.setLanguage(language);

    // Create query from the highlight query string
    this.query = this.parser.getLanguage().query(this.config.highlightQuery);

    // Set up editor change listeners
    this.editor.on('changes', this.handleCodeChange.bind(this));
    this.editor.on('viewportChange', this.scheduleHighlight.bind(this));

    // Initial parse
    await this.handleCodeChange(this.editor, null);
  }

  /**
   * Set a callback to be invoked after each parse
   */
  onParse(callback: (tree: Parser.Tree, duration: number) => void): void {
    this.onParseCallback = callback;
  }

  /**
   * Handle code changes and incrementally update the parse tree
   */
  private async handleCodeChange(editor: any, changes: any[]): Promise<void> {
    if (!this.parser) return;

    const newText = this.editor.getValue() + '\n';
    const edits = this.tree && changes ? changes.map(c => this.treeEditForEditorChange(c)) : null;

    const start = performance.now();

    // Apply incremental edits if available
    if (edits && this.tree) {
      for (const edit of edits) {
        this.tree.edit(edit);
      }
    }

    // Parse the updated text
    const newTree = this.parser.parse(newText, this.tree);
    const duration = performance.now() - start;

    // Clean up old tree
    if (this.tree) {
      this.tree.delete();
    }

    this.tree = newTree;
    this.parseCount++;

    // Notify listeners
    if (this.onParseCallback && this.tree) {
      this.onParseCallback(this.tree, duration);
    }

    // Schedule highlight update
    this.scheduleHighlight();
  }

  /**
   * Convert CodeMirror change to tree-sitter edit
   */
  private treeEditForEditorChange(change: any): Parser.Edit {
    const oldLineCount = change.removed.length;
    const newLineCount = change.text.length;
    const lastLineLength = change.text[newLineCount - 1].length;

    const startPosition = { row: change.from.line, column: change.from.ch };
    const oldEndPosition = { row: change.to.line, column: change.to.ch };
    const newEndPosition = {
      row: startPosition.row + newLineCount - 1,
      column: newLineCount === 1
        ? startPosition.column + lastLineLength
        : lastLineLength,
    };

    const startIndex = this.editor.indexFromPos(change.from);
    let newEndIndex = startIndex + newLineCount - 1;
    let oldEndIndex = startIndex + oldLineCount - 1;

    for (let i = 0; i < newLineCount; i++) {
      newEndIndex += change.text[i].length;
    }
    for (let i = 0; i < oldLineCount; i++) {
      oldEndIndex += change.removed[i].length;
    }

    return {
      startIndex,
      oldEndIndex,
      newEndIndex,
      startPosition,
      oldEndPosition,
      newEndPosition,
    };
  }

  /**
   * Schedule a highlight update with debouncing
   */
  private scheduleHighlight(): void {
    if (this.highlightDebounceTimer !== null) {
      clearTimeout(this.highlightDebounceTimer);
    }

    this.highlightDebounceTimer = window.setTimeout(() => {
      this.runTreeQuery();
      this.highlightDebounceTimer = null;
    }, this.config.highlightDebounceMs);
  }

  /**
   * Run tree-sitter query and apply syntax highlighting
   */
  private runTreeQuery(startRow?: number, endRow?: number): void {
    if (!this.tree || !this.query) return;

    // Get viewport if not specified
    if (startRow === undefined || endRow === undefined) {
      const viewport = this.editor.getViewport();
      startRow = viewport.from;
      endRow = viewport.to;
    }

    this.editor.operation(() => {
      // Clear existing marks
      const marks = this.editor.getAllMarks();
      marks.forEach((m: any) => m.clear());

      // Apply new highlights
      const captures = this.query!.captures(
        this.tree!.rootNode,
        { row: startRow!, column: 0 },
        { row: endRow!, column: 0 },
      );

      let lastNodeId: number | undefined;

      for (const { name, node } of captures) {
        // Skip duplicate captures for the same node
        if (node.id === lastNodeId) continue;
        lastNodeId = node.id;

        const { startPosition, endPosition } = node;
        const markOptions = this.getMarkOptions(name);

        this.editor.markText(
          { line: startPosition.row, ch: startPosition.column },
          { line: endPosition.row, ch: endPosition.column },
          {
            inclusiveLeft: true,
            inclusiveRight: true,
            ...markOptions,
          },
        );
      }
    });
  }

  /**
   * Get CodeMirror mark options for a capture name
   */
  private getMarkOptions(captureName: string): any {
    if (this.highlightConfig.useCssClasses) {
      return {
        className: `${this.highlightConfig.cssPrefix}${captureName}`,
      };
    }

    // Use inline styles with color
    const color = this.getColorForCapture(captureName);
    return {
      css: `color: ${color}`,
    };
  }

  /**
   * Get color for a capture name
   */
  private getColorForCapture(captureName: string): string {
    // Check custom color map first
    if (this.config.colorMap[captureName]) {
      return this.config.colorMap[captureName];
    }

    // Use index-based color from palette
    if (!this.query) return 'black';

    const captureIndex = this.query.captureNames.indexOf(captureName);
    const colors = this.highlightConfig.colors!;
    return colors[captureIndex % colors.length];
  }

  /**
   * Get the current parse tree
   */
  getTree(): Parser.Tree | null {
    return this.tree;
  }

  /**
   * Get the current parser
   */
  getParser(): Parser | null {
    return this.parser;
  }

  /**
   * Get parse count (useful for debugging)
   */
  getParseCount(): number {
    return this.parseCount;
  }

  /**
   * Manually trigger a re-parse
   */
  async reparse(): Promise<void> {
    await this.handleCodeChange(this.editor, null);
  }

  /**
   * Manually trigger a re-highlight
   */
  rehighlight(): void {
    this.runTreeQuery();
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.tree) {
      this.tree.delete();
      this.tree = null;
    }

    if (this.parseDebounceTimer !== null) {
      clearTimeout(this.parseDebounceTimer);
    }

    if (this.highlightDebounceTimer !== null) {
      clearTimeout(this.highlightDebounceTimer);
    }

    // Remove event listeners
    this.editor.off('changes', this.handleCodeChange);
    this.editor.off('viewportChange', this.scheduleHighlight);
  }
}

/**
 * Utility function to create a debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate = false,
): (...args: Parameters<T>) => void {
  let timeout: number | null = null;

  return function(this: any, ...args: Parameters<T>) {
    const context = this;

    const later = () => {
      timeout = null;
      if (!immediate) {
        func.apply(context, args);
      }
    };

    const callNow = immediate && !timeout;

    if (timeout !== null) {
      clearTimeout(timeout);
    }

    timeout = window.setTimeout(later, wait);

    if (callNow) {
      func.apply(context, args);
    }
  };
}
