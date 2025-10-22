import { parser } from "./tome-parser.js";
import {
  LRLanguage,
  LanguageSupport,
  foldNodeProp,
  indentNodeProp,
  delimitedIndent,
} from "@codemirror/language";
import { styleTags, tags as t } from "@lezer/highlight";
import { Tree, type SyntaxNode, TreeCursor } from "@lezer/common";
import type {
  AST,
  DialogueNode,
  Statement,
  Expression,
  Interpolation,
  AssignmentOperator,
} from "../dsl/types.js";

// Define syntax highlighting
const tomeHighlighting = styleTags({
  Identifier: t.variableName,
  "node say choice goto if end random": t.keyword,
  Variable: t.variableName,
  Symbol: t.atom,
  Number: t.number,
  String: t.string,
  "True False": t.bool,
  Comment: t.lineComment,
  "( )": t.paren,
  ", :": t.punctuation,
  AssignmentOp: t.definitionOperator,
  ComparisonOp: t.compareOperator,
  "LogicalOrOp LogicalAndOp": t.logicOperator,
  "UnaryOp AddOp SubOp MulOp DivOp": t.operator,
  FunctionCall: t.function(t.variableName),
});

// Create the language
export const tomeLanguage = LRLanguage.define({
  parser: parser.configure({
    props: [
      tomeHighlighting,
      foldNodeProp.add({
        Node: (node: SyntaxNode) => ({ from: node.from, to: node.to }),
      }),
      indentNodeProp.add({
        Node: (context) => {
          const baseIndent = context.baseIndentFor(context.node);

          if (/^\s*end/.test(context.textAfter)) {
            return baseIndent;
          }

          const nodeKeyword = context.node.firstChild;
          const identifier = nodeKeyword?.nextSibling;
          const newline = identifier?.nextSibling;

          if (!newline || context.pos <= newline.to) {
            return context.continue();
          }

          return baseIndent + context.unit;
        },

        ParenExpression: delimitedIndent({ closing: ")" }),

        String: () => null,
      }),
    ],
  }),
  languageData: {
    commentTokens: { line: "#" },
    closeBrackets: { brackets: ["(", '"'] },
    indentOnInput: /^\s*end$/,
  },
});

// Create language support with extensions
export function tome(): LanguageSupport {
  return new LanguageSupport(tomeLanguage);
}

// Export parser for testing/AST generation
export { parser };
