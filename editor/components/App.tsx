import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { DragHandleDots2Icon } from "@radix-ui/react-icons";
import Editor from "./Editor.tsx";
import { LayoutSwitcher } from "./LayoutSwitcher.tsx";
import { useLayoutState } from "../lib/state.ts";
import React from "react";
import { Toaster } from "./ui/sonner.tsx";
import Preview from "./Preview.tsx";

export default function App() {
  const panels = useLayoutState((state) => state.panels);

  const panelConfigs = [
    {
      id: "editor",
      visible: panels.editor?.value,
      component: (
        <Panel
          defaultSize={40}
          minSize={20}
          id="editor-panel"
          order={1}
          className="flex flex-col"
        >
          <Editor />
        </Panel>
      ),
    },
    {
      id: "preview",
      visible: panels.preview?.value,
      component: (
        <Panel minSize={30} defaultSize={30} id="preview-panel" order={2}>
          <Preview />
        </Panel>
      ),
    },
    {
      id: "player",
      visible: panels.player?.value,
      component: (
        <Panel defaultSize={30} minSize={20} id="player-panel" order={3}>
          Player
        </Panel>
      ),
    },
  ];

  const visiblePanels = panelConfigs.filter((p) => p.visible);
  return (
    <div className="h-screen flex flex-col">
      <Toaster position="bottom-center" />
      <div>
        <LayoutSwitcher />
      </div>
      <PanelGroup
        direction="horizontal"
        autoSaveId="conditional"
        className="flex-grow"
      >
        {visiblePanels.map((p, i) => (
          <React.Fragment key={p.id}>
            {p.component}
            {i < visiblePanels.length - 1 && (
              <PanelResizeHandle className="w-[0.5rem] bg-gray-200 flex justify-center items-center hover:bg-gray-300 cursor-col-resize">
                <DragHandleDots2Icon />
              </PanelResizeHandle>
            )}
          </React.Fragment>
        ))}
      </PanelGroup>
    </div>
  );
}

