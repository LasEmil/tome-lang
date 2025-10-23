import { create } from "zustand";
import type { NodeNetwork } from "../../dsl/types.ts";

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

type NodeNetworkStoreState = {
  network: NodeNetwork | null;
  loading: boolean;
};
type NodeNetworkStoreActions = {
  setNetwork: (network: NodeNetwork) => void;
  setLoading: (loading: boolean) => void;
};

type NodeNetworkStore = NodeNetworkStoreState & NodeNetworkStoreActions;
export const useNodeNetworkStore = create<NodeNetworkStore>((set) => ({
  network: null,
  loading: true,
  setNetwork: (network: NodeNetwork) => set({ network, loading: false }),
  setLoading: (loading: boolean) => set({ loading }),
}));
