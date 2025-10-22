import { create } from "zustand";
import type { EdgesMap } from "../../dsl/types.ts";
import type { Diagnostic } from "@codemirror/lint";

type Panel = {
  id: string;
  name: string;
  value: boolean;
};
type LayoutStoreState = { panels: Record<Panel["id"], Panel> };
type LayoutStoreActions = {
  updatePanels: (newPanelsArray: string[]) => void;
};

type LayoutStore = LayoutStoreState & LayoutStoreActions;
export const useLayoutState = create<LayoutStore>((set) => ({
  panels: {
    editor: { id: "editor", name: "Editor", value: true },
    preview: { id: "preview", name: "Preview", value: true },
    player: { id: "player", name: "Player", value: true },
  },
  updatePanels: (newPanelsArray: string[]) =>
    set((state) => {
      return {
        panels: Object.fromEntries(
          Object.entries(state.panels).map(([key, panel]) => [
            key,
            {
              ...panel,
              value: newPanelsArray.includes(key),
            },
          ]),
        ),
      };
    }),
}));

type NodeStoreState = {
  nodes: EdgesMap;
  loading: boolean;
}
type NodeStoreActions = {
  setNodes: (nodes: EdgesMap) => void;
  setLoading: (loading: boolean) => void;
};

type NodeStore = NodeStoreState & NodeStoreActions;
export const useNodeStore = create<NodeStore>((set) => ({
  nodes: new Map(),
  loading: true,
  setNodes: (nodes: EdgesMap) => set({ nodes, loading: false }),
  setLoading: (loading: boolean) => set({ loading })
}));

type DiagnosticStoreState = {
  diagnostics: Diagnostic[]
  text: string
};
type DiagnosticStoreActions = {
  setDiagnostics: (diagnostics: Diagnostic[], text: string) => void;
};
type DiagnosticStore = DiagnosticStoreState & DiagnosticStoreActions;
export const useDiagnosticStore = create<DiagnosticStore>((set => ({
  diagnostics: [],
  text: "",
  setDiagnostics: (diagnostics: Diagnostic[], text: string) => set({ diagnostics, text })
})));
