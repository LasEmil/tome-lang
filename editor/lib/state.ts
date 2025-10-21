import { create } from "zustand";

type Panel = {
  id: string;
  name: string;
  value: boolean;
};
type LayoutStoreState = { panels: Record<Panel["id"], Panel> };
type LayoutStoreActions = {
  updatePanels: (newPanelsArray: string[]) => void;
  togglePanel: (panelId: Panel["id"]) => void;
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
  togglePanel: (panelId: Panel["id"]) =>
    set((state) => {
      return {
        panels: {
          ...state.panels,
          [panelId]: {
            ...state.panels[panelId],
            value: !state.panels[panelId].value,
          },
        },
      };
    }),
}));
