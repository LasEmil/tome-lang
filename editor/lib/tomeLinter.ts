import type { Diagnostic } from "@codemirror/lint";
import type { Text } from "@codemirror/state";
import type { EditorView } from "codemirror";
import { Lexer } from "../../dsl/lexer.ts";
import { Parser } from "../../dsl/parser.ts";
import { Analyzer } from "../../dsl/analyzer.ts";

// Helper function to get word boundaries for better error highlighting
export const getWordRange = (doc: Text, line: number, column: number): { from: number; to: number } => {
  const docLine = doc.line(line);
  const lineText = docLine.text;
  const pos = column - 1; // Convert to 0-indexed

  // If position is out of bounds, return single character
  if (pos < 0 || pos >= lineText.length) {
    return {
      from: docLine.from + Math.max(0, Math.min(pos, lineText.length - 1)),
      to: docLine.from + Math.max(1, Math.min(pos + 1, lineText.length))
    };
  }

  // Check if we're in a string by looking for quotes around the position
  // Search backwards for an opening quote
  let quoteStart = -1;
  let quoteChar = null;
  for (let i = pos; i >= 0; i--) {
    if (lineText[i] === '"' || lineText[i] === "'") {
      quoteStart = i;
      quoteChar = lineText[i];
      break;
    }
  }

  // If we found a quote before our position, search forward for the closing quote
  if (quoteStart !== -1 && quoteChar) {
    let quoteEnd = quoteStart + 1;
    while (quoteEnd < lineText.length && lineText[quoteEnd] !== quoteChar) {
      quoteEnd++;
    }
    // Check if our position is within this string
    if (quoteEnd < lineText.length && pos >= quoteStart && pos <= quoteEnd) {
      return {
        from: docLine.from + quoteStart,
        to: docLine.from + quoteEnd + 1 // Include closing quote
      };
    }
  }

  // Find start of word (alphanumeric, underscore, @, :, or other identifier chars)
  // Include @ for variables and : for node references
  let start = pos;
  while (start > 0 && /[@:\w]/.test(lineText[start - 1]!)) {
    start--;
  }

  // Find end of word
  let end = pos;
  while (end < lineText.length && /[@:\w]/.test(lineText[end]!)) {
    end++;
  }

  // If we didn't find a word, highlight at least a few characters or to end of line
  if (start === end) {
    end = Math.min(start + 1, lineText.length);
  }

  return {
    from: docLine.from + start,
    to: docLine.from + end
  };
};


// Cache for preserving diagnostics across linter runs
let lastValidAnalysis: { diagnostics: Diagnostic[]; text: string } | null = null;
export const tomeLinter = (view: EditorView): readonly Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];
  const text = view.state.doc.toString();
  const lexer = new Lexer(text)
  const lexResult = lexer.lex();
  console.log("Lexer result:", lexResult);
  if(!lexResult.valid) {
    for(const err of lexResult.errors) {
      const range = getWordRange(view.state.doc, err.line, err.column);
      diagnostics.push({
        from: range.from,
        to: range.to,
        severity: "error",
        message: err.message,
      });
    }

    // Preserve previous analyzer warnings/suggestions if available
    if (lastValidAnalysis) {
      return [...diagnostics, ...lastValidAnalysis.diagnostics.filter(d => d.severity !== "error")];
    }

    return diagnostics;
  }

  const parser = new Parser(lexResult.value.values(), text);
  const parseResult = parser.parse();
  console.log("Parser result:", parseResult);
  if(!parseResult.valid) {
    for(const err of parseResult.errors) {
      const range = getWordRange(view.state.doc, err.line, err.column);
      diagnostics.push({
        from: range.from,
        to: range.to,
        severity: "error",
        message: err.message,
      });
    }

    // Preserve previous analyzer warnings/suggestions if available
    if (lastValidAnalysis) {
      return [...diagnostics, ...lastValidAnalysis.diagnostics.filter(d => d.severity !== "error")];
    }

    return diagnostics;
  }

  const analyzer = new Analyzer();
  if(parseResult.value) {
    for(const node of parseResult.value.nodes){
      analyzer.analyzeNode(node);
    }
  }

  const analysisResult = analyzer.finalizeAnalysis()
  console.log("Analysis result:", analysisResult);
  if(!analysisResult.valid) {
    for(const err of analysisResult.errors) {
      const range = getWordRange(view.state.doc, err.line, err.column);
      diagnostics.push({
        from: range.from,
        to: range.to,
        severity: "error",
        message: err.message,
      });
    }

    for (const warning of analysisResult.warnings) {
      const range = getWordRange(view.state.doc, warning.line, warning.column);
      diagnostics.push({
        from: range.from,
        to: range.to,
        severity: "warning",
        message: warning.message,
      });
    }

    if(analysisResult.suggestions){
      for (const info of analysisResult.suggestions) {
        const range = getWordRange(view.state.doc, info.line, info.column);
        diagnostics.push({
          from: range.from,
          to: range.to,
          severity: "info",
          message: info.message,
        });
      }
    }
  }

  // Cache successful analysis for future use
  lastValidAnalysis = { diagnostics, text };

  return diagnostics;
};
