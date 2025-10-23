import { useEffect, useRef, type RefObject } from "react";
import { monaco } from "../lib/monaco.ts";
import { text } from "../data/defaultText.ts";
import Parser from "web-tree-sitter";
import treeSitterWasm from "web-tree-sitter/tree-sitter.wasm?url";
import tomeWasm from "../../tree-sitter-tome/tree-sitter-tome.wasm?url";
import { Theme, Language, MonacoTreeSitter } from "monaco-tree-sitter";
import tomeGrammar from "../data/tome.json" with { type: "json" };
import * as Monaco from "monaco-editor";
import { setupLSPForMonaco } from "../../lsp/client.ts";
import TomeLSPWorkerURL from "../../lsp/worker.ts?url";
import { theme } from "../lib/theme.ts";
import { toast } from "sonner";
import { getSavedEditor, saveEditor } from "../lib/monacoPersist.ts";

Theme.load(theme);
async function initializeLSP(editor: monaco.editor.IStandaloneCodeEditor) {
  try {
    const { client, cleanup } = await setupLSPForMonaco(
      editor,
      TomeLSPWorkerURL,
      "file://test.tome",
      "tome",
    );

    console.log("LSP initialized successfully!");

    window.addEventListener("beforeunload", () => {
      cleanup();
      client.shutdown();
    });

    return client;
  } catch (error) {
    console.error("Failed to initialize LSP:", error);
  }
}

const TOME = "tome";
export const useMonaco = (ref: RefObject<HTMLDivElement | null>) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  async function loadEditor(ref: RefObject<HTMLDivElement | null>) {
    if (!ref.current) return;
    await Parser.init({
      locateFile() {
        return treeSitterWasm;
      },
    });

    const language = new Language(tomeGrammar);
    await language.init(tomeWasm, Parser);

    const models = monaco.editor.getModels();
    const existingModel = models.find(
      (model) => model.uri.toString() === `file://test.${TOME}/`,
    );

    const savedEditor = await getSavedEditor();
    const initialEditorValue = savedEditor?.value ?? text;
    const editor = monaco.editor.create(ref.current, {
      value: initialEditorValue,
      language: TOME,
      automaticLayout: true,
      wordWrap: "on",
      minimap: { enabled: false },
      theme: "cattppuccin-mocha",
      model:
        existingModel ??
        monaco.editor.createModel(
          initialEditorValue,
          TOME,
          monaco.Uri.parse(`file://test.${TOME}`),
        ),
    });
    if (savedEditor?.viewState) {
      editor.restoreViewState(savedEditor.viewState);
    }

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      toast.info("File is saved automatically!");
    });
    editor.onDidChangeModelContent(async () => {
      try {
        await saveEditor(editor);
      } catch (error) {
        console.error("Failed to save editor state:", error);
      }
    });

    await initializeLSP(editor);

    new MonacoTreeSitter(Monaco, editor, language);

    return editor;
  }

  useEffect(() => {
    console.log("Loading Monaco editor");
    console.log(editorRef.current);

    if (editorRef.current) return;
    loadEditor(ref).then((editor) => {
      if (editor) {
        editorRef.current = editor;
      }
    });

    return () => {
      if (editorRef.current) {
        console.log("Disposing editor");
        editorRef.current.dispose();
        editorRef.current = null;
      }
    };
  }, [ref]);

  return editorRef;
};
