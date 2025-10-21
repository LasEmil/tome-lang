/**
 * CodeMirror 6 + Tree-sitter Adapter
 *
 * A general-purpose adapter that integrates any tree-sitter grammar
 * with CodeMirror 6 for syntax highlighting and parsing.
 */

import {
  EditorView,
  Decoration,
  type DecorationSet,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import {
  StateField,
  StateEffect,
  type Extension,
  RangeSetBuilder,
} from "@codemirror/state";
import { Facet } from "@codemirror/state";
import Parser from "web-tree-sitter";

export interface TreeSitterConfig {
  /** Tree-sitter parser instance */
  parser: Parser;

  /** Tree-sitter query for syntax highlighting */
  highlightQuery: string;

  /** Optional color map for captures (defaults to built-in colors) */
  colorMap?: Record<string, string>;

  /** Whether to use CSS classes instead of inline styles */
  useCssClasses?: boolean;

  /** CSS class prefix when useCssClasses is true */
  cssPrefix?: string;

  /** Callback invoked after each parse */
  onParse?: (tree: Parser.Tree, duration: number) => void;
}

// Effect to update the parse tree
const setTreeEffect = StateEffect.define<Parser.Tree>();

// StateField to hold the current tree-sitter tree
const treeField = StateField.define<Parser.Tree | null>({
  create() {
    return null;
  },
  update(tree, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setTreeEffect)) {
        return effect.value;
      }
    }
    return tree;
  },
});

// Default color palette for syntax highlighting
const DEFAULT_COLORS = [
  "#0451a5", // blue
  "#a31515", // red
  "#008000", // green
  "#af00db", // purple
  "#001080", // dark blue
  "#e50000", // bright red
  "#0000ff", // pure blue
  "#008080", // teal
  "#a31515", // brick red
  "#795e26", // brown
];

/**
 * CodeMirror 6 ViewPlugin for tree-sitter integration
 */
class TreeSitterViewPlugin {
  tree: Parser.Tree | undefined = undefined;
  decorations: DecorationSet = Decoration.none;
  parseCount = 0;
  private isInitializing = true;

  constructor(
    private view: EditorView,
    private parser: Parser,
    private query: Parser.Query,
    private config: TreeSitterConfig,
  ) {
    this.parse(view);
    this.isInitializing = false;
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged) {
      this.parse(update.view);
    }
  }

  private parse(view: EditorView) {
    const start = performance.now();
    const text = view.state.doc.toString();

    console.log(`[TreeSitter] Parsing document (${text.length} chars, parse #${this.parseCount + 1})`);

    // Get the old tree for incremental parsing
    const oldTree = this.tree;

    // Parse the document
    this.tree = this.parser.parse(text, oldTree);
    this.parseCount++;

    const duration = performance.now() - start;

    console.log(`[TreeSitter] Parse completed in ${duration.toFixed(2)}ms`);
    console.log(`[TreeSitter] Root node:`, this.tree.rootNode.toString());
    console.log(`[TreeSitter] Has errors:`, this.tree.rootNode.hasError);

    // Update decorations
    this.decorations = this.buildDecorations(view);

    // Dispatch effect to update the state field (but not during initialization)
    if (!this.isInitializing) {
      console.log("[TreeSitter] Dispatching tree update effect");
      view.dispatch({
        effects: setTreeEffect.of(this.tree),
      });
    } else {
      console.log("[TreeSitter] Skipping dispatch during initialization");
    }

    // Invoke callback if provided
    if (this.config.onParse) {
      this.config.onParse(this.tree, duration);
    }
  }

  private buildDecorations(view: EditorView): DecorationSet {
    if (!this.tree) {
      console.log("[TreeSitter] No tree available for decorations");
      return Decoration.none;
    }

    const builder = new RangeSetBuilder<Decoration>();
    const { from, to } = view.viewport;

    console.log(`[TreeSitter] Building decorations for viewport: ${from} to ${to}`);

    // Convert document positions to tree-sitter positions
    const startPos = view.state.doc.lineAt(from);
    const endPos = view.state.doc.lineAt(to);

    console.log(`[TreeSitter] Query range: line ${startPos.number - 1} to line ${endPos.number}`);

    const captures = this.query.captures(
      this.tree.rootNode,
      { row: startPos.number - 1, column: 0 },
      { row: endPos.number, column: 0 },
    );

    console.log(`[TreeSitter] Query returned ${captures.length} captures`);

    let lastNodeId: number | undefined;
    let decorationCount = 0;
    let skippedDuplicates = 0;
    let skippedOutOfRange = 0;

    for (const { name, node } of captures) {
      // Skip duplicate captures for the same node
      if (node.id === lastNodeId) {
        skippedDuplicates++;
        continue;
      }
      lastNodeId = node.id;

      const startIndex = node.startIndex;
      const endIndex = node.endIndex;

      // Skip if outside viewport
      if (endIndex < from || startIndex > to) {
        skippedOutOfRange++;
        continue;
      }

      // Create decoration
      const decoration = this.createDecoration(name);

      // Only log first few decorations to avoid spam
      if (decorationCount < 5) {
        const color = this.getColorForCapture(name);
        const text = view.state.doc.sliceString(startIndex, endIndex);
        console.log(`[TreeSitter] Adding decoration #${decorationCount}: ${name} [${startIndex}-${endIndex}] color:${color} text:"${text}"`);
      }

      builder.add(startIndex, endIndex, decoration);
      decorationCount++;
    }

    console.log(`[TreeSitter] Decorations: ${decorationCount} added, ${skippedDuplicates} duplicates skipped, ${skippedOutOfRange} out of range`);

    return builder.finish();
  }

  private createDecoration(captureName: string): Decoration {
    if (this.config.useCssClasses) {
      const className = `${this.config.cssPrefix || "ts-"}${captureName}`;
      return Decoration.mark({
        class: className,
      });
    }

    // Use inline styles
    const color = this.getColorForCapture(captureName);
    return Decoration.mark({
      attributes: { style: `color: ${color}` },
    });
  }

  private getColorForCapture(captureName: string): string {
    // Check custom color map first (use hasOwn to avoid prototype pollution)
    if (this.config.colorMap && Object.hasOwn(this.config.colorMap, captureName)) {
      return this.config.colorMap[captureName];
    }

    // Use index-based color from palette
    const captureIndex = this.query.captureNames.indexOf(captureName);
    const color = DEFAULT_COLORS[captureIndex % DEFAULT_COLORS.length];
    return color;
  }

  destroy() {
    if (this.tree) {
      this.tree.delete();
    }
  }
}

/**
 * Create a CodeMirror 6 extension for tree-sitter syntax highlighting
 */
export function treeSitter(config: TreeSitterConfig): Extension {
  console.log("[TreeSitter] Initializing parser:", config.parser);
  console.log("[TreeSitter] Language:", config.parser.getLanguage());

  const query = config.parser.getLanguage().query(config.highlightQuery);
  console.log("[TreeSitter] Query created with captures:", query.captureNames);
  console.log("[TreeSitter] Query pattern count:", query.patternCount);
  console.log("[TreeSitter] Full query:", config.highlightQuery);

  const viewPlugin = ViewPlugin.fromClass(
    class extends TreeSitterViewPlugin {
      constructor(view: EditorView) {
        super(view, config.parser, query, config);
      }
    },
    {
      decorations: (plugin) => plugin.decorations,
    },
  );

  return [treeField, viewPlugin];
}

/**
 * Get the current parse tree from an EditorView
 */
export function getTree(view: EditorView): Parser.Tree | null {
  return view.state.field(treeField, false) ?? null;
}

/**
 * Helper to create a tree-sitter parser for CodeMirror
 */
export async function createTreeSitterParser(
  TreeSitter: typeof Parser,
  grammarPath: string,
): Promise<Parser> {
  await TreeSitter.init();

  const parser = new TreeSitter();
  const language = await TreeSitter.Language.load(grammarPath);
  parser.setLanguage(language);

  return parser;
}

/**
 * Utility: Create a facet-based configuration for tree-sitter
 * (Advanced usage for more complex scenarios)
 */
export interface TreeSitterFacetConfig {
  colorMap?: Record<string, string>;
  useCssClasses?: boolean;
  cssPrefix?: string;
}

export const treeSitterFacet = Facet.define<
  TreeSitterFacetConfig,
  TreeSitterFacetConfig
>({
  combine(configs) {
    return {
      colorMap: configs.reduce((acc, c) => ({ ...acc, ...c.colorMap }), {}),
      useCssClasses: configs.some((c) => c.useCssClasses),
      cssPrefix: configs.find((c) => c.cssPrefix)?.cssPrefix || "ts-",
    };
  },
});
