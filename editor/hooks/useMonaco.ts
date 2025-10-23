import { useEffect, useRef, type RefObject } from "react";
import {monaco} from "../lib/monaco.ts";
import { text } from "../data/defaultText.ts";
import Parser from "web-tree-sitter";
import treeSitterWasm from 'web-tree-sitter/tree-sitter.wasm?url';
import tomeWasm from '../../tree-sitter-tome/tree-sitter-tome.wasm?url';
import { Theme, Language, MonacoTreeSitter, type ThemeConfig } from "monaco-tree-sitter";
import tomorrow from "monaco-tree-sitter/themes/tomorrow.json" with { type: "json" };
import tomeGrammar from "../data/tome.json" with { type: "json" };
import * as Monaco from "monaco-editor";

Theme.load(tomorrow as ThemeConfig);

export const useMonaco = (ref: RefObject<HTMLDivElement | null>) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  async function loadEditor(ref: RefObject<HTMLDivElement | null>) {
  if (!ref.current) return;
    await Parser.init({
      locateFile(scriptName: string, scriptDirectory: string) {
        return treeSitterWasm;
      },
    });


    const language = new Language(tomeGrammar)
    await language.init(tomeWasm, Parser);

    const editor = monaco.editor.create(ref.current, {
      value: text,
      language: "tome",
      automaticLayout: true,
      wordWrap: "on",
      minimap: { enabled: false },
    })

    const monacoTreeSitter = new MonacoTreeSitter(Monaco, editor, language);

    return editor;
  }

  useEffect(() => {
    loadEditor(ref).then((editor) => {
      if (editor) {
        editorRef.current = editor;
      }
    });

    return () => {
      if (editorRef.current) {
        editorRef.current.dispose();
      }
    }

  }, [ref]);

  return editorRef;
}

