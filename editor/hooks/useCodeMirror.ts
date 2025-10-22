import { EditorState, type EditorStateConfig } from "@codemirror/state";
import { EditorView, basicSetup } from "codemirror";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { useEffect, useRef } from "react";
import { type KeyBinding, keymap } from "@codemirror/view";
import { catppuccinMocha } from "@catppuccin/codemirror";
import { tomeLanguage } from "../../lezer-tome/index.ts";
import { toast } from "sonner";
import { linter, type Diagnostic } from "@codemirror/lint";
import { syntaxTree } from "@codemirror/language";
import { resetIndentation } from "../../lezer-tome/tokens.ts";

const saveKeybinding: KeyBinding = {
  key: "Mod-s",
  preventDefault: true,
  run: () => {
    toast("File is saved automatically!");
    return true;
  },
};

const persistenceExtension = EditorView.updateListener.of((update) => {
  if (!localStorage) return;
  resetIndentation();
  if (update.docChanged) {
    const state = update.state.toJSON();
    localStorage.setItem("editorContent", JSON.stringify(state));
  }
});

const tomeLinter = (view: EditorView): readonly Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];
  // const text = view.state.doc.toString();
  // console.log("Linting text:", text);

  syntaxTree(view.state).iterate({
    enter: (node) => {
      if (node.type.isError) {
        console.log("Error node:", node);
      }
      if (node.type.isError) {
        diagnostics.push({
          from: node.from,
          to: node.to,
          severity: "error",
          message: "Syntax error detected",
        });
      }
    },
  });

  console.log("Diagnostics:", diagnostics);
  return diagnostics;
};

const editorConfig: EditorStateConfig = {
  extensions: [
    basicSetup,
    keymap.of([...defaultKeymap, indentWithTab, saveKeybinding]),
    catppuccinMocha,
    tomeLanguage,
    EditorView.lineWrapping,
    persistenceExtension,
    linter(tomeLinter),
  ],
};

const getEditorState = (defaultText: string) => {
  const defaultState = EditorState.create({
    ...editorConfig,
    doc: defaultText,
  });
  if (!localStorage) {
    return defaultState;
  }
  const savedContent = localStorage.getItem("editorContent");
  try {
    if (savedContent) {
      const parsed = JSON.parse(savedContent);
      return EditorState.fromJSON(parsed, editorConfig);
    }
  } catch (e) {
    console.error("Failed to parse saved editor content:", e);
  }
  return defaultState;
};
export const useCodeMirror = ({ defaultText }: { defaultText: string }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;

    const startState = getEditorState(defaultText);

    const view = new EditorView({
      state: startState,
      parent: ref.current,
    });

    return () => {
      view.destroy();
    };
  }, [ref]);

  return ref;
};
