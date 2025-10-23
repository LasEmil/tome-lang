import type { monaco } from "./monaco.ts";

type EditorState = {
  value: string;
  viewState: monaco.editor.ICodeEditorViewState | null;
};
export const saveEditor = async (
  editor: monaco.editor.IStandaloneCodeEditor,
) => {
  try {
    const model = editor.getModel();
    if (!model) return;
    const value = model.getValue();
    const viewState = editor.saveViewState();
    const state: EditorState = { value, viewState };
    const serializedState = JSON.stringify(state, null, 2);
    localStorage.setItem("monaco-editor-state", serializedState);

    return Promise.resolve();
  } catch (error) {
    return Promise.reject(error);
  }
};

export const getSavedEditor = async (): Promise<EditorState | null> => {
  try {
    const serializedState = localStorage.getItem("monaco-editor-state");
    if (!serializedState) return null;
    const state: EditorState = JSON.parse(serializedState);
    return state;
  } catch (error) {
    return Promise.reject(error);
  }
};
