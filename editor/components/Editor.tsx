import { useRef } from "react";
import { useMonaco } from "../hooks/useMonaco.ts";
import type { monaco } from "../lib/monaco.ts";
import type { LSPClient } from "../../lsp/client.ts";

type EditorProps = {
  onEditorReady?: (args: {
    editor?: monaco.editor.IStandaloneCodeEditor;
    lspClient?: LSPClient;
  }) => void;
};
export default function Editor({ onEditorReady }: EditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const editor = useMonaco(ref, onEditorReady);

  return <div ref={ref} />;
}
