import { create } from "zustand";
import type { EdgesMap, NodeNetwork } from "../../dsl/types.ts";
import type { Diagnostic } from "../../lsp/types.ts";

type Panel = {
  id: string;
  name: string;
  value: boolean;
};
type LayoutStoreState = { panels: Record<Panel["id"], Panel> };
type LayoutStoreActions = {
  updatePanels: (newPanelsArray: string[]) => void;
  toggle: (name: string) => void;
};

type LayoutStore = LayoutStoreState & LayoutStoreActions;
export const useLayoutState = create<LayoutStore>((set) => ({
  panels: {
    editor: { id: "editor", name: "Editor", value: true },
    preview: { id: "preview", name: "Preview", value: true },
    player: { id: "player", name: "Player", value: true },
  },
  toggle: (name: string) => {
    set((state) => ({
      panels: {
        ...state.panels,
        [name]: {
          ...state.panels[name],
          value: !state.panels[name]?.value,
        } as Panel,
      },
    }));
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

type NodeNetworkStoreState = {
  network: NodeNetwork | null;
  edgeMap: EdgesMap | null;
  loading: boolean;
};
type NodeNetworkStoreActions = {
  setNetwork: (network: NodeNetwork) => void;
  setEdgeMap: (edgeMap: EdgesMap) => void;
  setLoading: (loading: boolean) => void;
};

type NodeNetworkStore = NodeNetworkStoreState & NodeNetworkStoreActions;
export const useNodeNetworkStore = create<NodeNetworkStore>((set, get) => ({
  network: null,
  loading: true,
  edgeMap: new Map(),
  setNetwork: (network: NodeNetwork) => {
    if (!network) {
      return;
    }
    const currentNetwork = get().network;
    if (JSON.stringify(currentNetwork) === JSON.stringify(network)) {
      return;
    }
    set({ network, loading: false });
  },
  setEdgeMap: (edgeMap: EdgesMap) => {
    if (!edgeMap) {
      return;
    }
    set({ edgeMap, loading: false });
  },

  setLoading: (loading: boolean) => set({ loading }),
}));

type DiagnosticStoreState = {
  diagnostics: Diagnostic[];
};

type DiagnosticStoreActions = {
  setDiagnostics: (diagnostics: Diagnostic[]) => void;
  clearDiagnostics: () => void;
};
type DiagnosticStore = DiagnosticStoreState & DiagnosticStoreActions;
export const useDiagnosticStore = create<DiagnosticStore>((set) => ({
  diagnostics: [],
  setDiagnostics: (diagnostics: Diagnostic[]) => set({ diagnostics }),
  clearDiagnostics: () => set({ diagnostics: [] }),
}));
