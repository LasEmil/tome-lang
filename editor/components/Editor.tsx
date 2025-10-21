import { EditorState } from "@codemirror/state";
import { EditorView, basicSetup } from "codemirror";
import { defaultKeymap } from "@codemirror/commands";
import { keymap } from "@codemirror/view";
import { catppuccinMocha } from "@catppuccin/codemirror";
import { StreamLanguage } from "@codemirror/language";
import { useEffect, useRef } from "react";
import { text } from "./EditorDefaultText.ts";
import { tomeStreamParser } from "../lib/tomeStreamParser.ts";

export default function Editor() {
  const ref = useRef(null);

  const setupEditor = () => {
    console.log("[Editor] Setting up editor with StreamParser");

    // Create the Tome language from the StreamParser
    const tomeLanguage = StreamLanguage.define(tomeStreamParser);

    const startState = EditorState.create({
      doc: text,
      extensions: [
        basicSetup,
        keymap.of(defaultKeymap),
        catppuccinMocha,
        tomeLanguage,
        EditorView.lineWrapping,
      ],
    });

    console.log("[Editor] Editor state created, creating view...");

    const view = new EditorView({
      state: startState,
      parent: ref.current,
    });

    console.log("[Editor] Editor view created successfully!");
  };

  useEffect(() => {
    console.log("[Editor] useEffect running, ref.current:", ref.current);
    if (!ref.current) {
      console.warn("[Editor] ref.current is null, skipping setup");
      return;
    }

    setupEditor();

    return () => {
      console.log("[Editor] Cleanup running");
    };
  }, []);

  return <div ref={ref}></div>;
}
