import { EditorState, type EditorStateConfig } from "@codemirror/state";
import { EditorView, basicSetup } from "codemirror";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { useEffect, useRef } from "react";
import { type KeyBinding, keymap } from "@codemirror/view";
import { catppuccinMocha } from "@catppuccin/codemirror";
import { toast } from "sonner";
import { linter} from "@codemirror/lint";
import { StreamLanguage} from "@codemirror/language";
import { tomeStreamParser } from "../lib/tomeStreamParser.ts";
import { tomeLinter } from "../lib/tomeLinter.ts";

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
  if (update.docChanged) {
    const state = update.state.toJSON();
    localStorage.setItem("editorContent", JSON.stringify(state));
  }
});

const tomeLanguage = StreamLanguage.define(tomeStreamParser);
const editorConfig: EditorStateConfig = {
  extensions: [
    basicSetup,
    keymap.of([...defaultKeymap, indentWithTab, saveKeybinding]),
    catppuccinMocha,
    tomeLanguage,
    EditorView.lineWrapping,
    persistenceExtension,
    linter(tomeLinter, { delay: 500 }),
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
