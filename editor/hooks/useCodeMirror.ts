import { StreamLanguage } from "@codemirror/language";
import { tomeStreamParser } from "../lib/tomeStreamParser.ts";
import { EditorState } from "@codemirror/state";
import { EditorView, basicSetup } from "codemirror";
import { defaultKeymap } from "@codemirror/commands";
import { useEffect, useRef } from "react";
import { keymap } from "@codemirror/view";
import { catppuccinMocha } from "@catppuccin/codemirror";

export const useCodeMirror = ({ defaultText }: { defaultText: string }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    const tomeLanguage = StreamLanguage.define(tomeStreamParser);

    const startState = EditorState.create({
      doc: defaultText,
      extensions: [
        basicSetup,
        keymap.of(defaultKeymap),
        catppuccinMocha,
        tomeLanguage,
        EditorView.lineWrapping,
      ],
    });

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
