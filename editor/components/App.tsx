import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { DragHandleDots2Icon } from "@radix-ui/react-icons";
import Editor from "./Editor.tsx";
import { useLayoutState } from "../lib/state.ts";
import React from "react";
import { Toaster } from "./ui/sonner.tsx";
import Preview from "./Preview.tsx";
import type { monaco } from "../lib/monaco.ts";
import type { LSPClient } from "../../lsp/client.ts";

export default function App() {
  const panels = useLayoutState((state) => state.panels);
  const [editor, setEditor] = React.useState<{
    editor?: monaco.editor.IStandaloneCodeEditor;
    lspClient?: LSPClient;
  }>({});

  const onNodeClick = (nodeId: string) => {
    editor?.lspClient?.didSelectNode(nodeId);
  };

  const panelConfigs = [
    {
      id: "editor",
      visible: panels.editor?.value,
      component: (
        <Panel
          defaultSize={50}
          minSize={20}
          id="editor-panel"
          order={1}
          className="flex flex-col rounded-md overflow-hidden"
        >
          <Editor onEditorReady={setEditor} />
        </Panel>
      ),
    },
    {
      id: "preview",
      visible: panels.preview?.value,
      component: (
        <Panel
          minSize={15}
          defaultSize={25}
          id="preview-panel"
          order={2}
          className="flex flex-col rounded-md overflow-hidden"
        >
          <Preview onNodeClick={onNodeClick} />
        </Panel>
      ),
    },
    {
      id: "player",
      visible: panels.player?.value,
      component: (
        <Panel
          defaultSize={25}
          minSize={20}
          id="player-panel"
          order={3}
          className="flex flex-col rounded-md overflow-hidden"
        >
          Player
        </Panel>
      ),
    },
  ];

  const visiblePanels = panelConfigs.filter((p) => p.visible);
  return (
    <div className="h-screen flex flex-col bg-gray-200 p-4">
      <Toaster position="bottom-center" />
      {/* <div> */}
      {/*   <LayoutSwitcher /> */}
      {/* </div> */}
      <PanelGroup
        direction="horizontal"
        autoSaveId="conditional"
        className="flex-grow"
      >
        {visiblePanels.map((p, i) => (
          <React.Fragment key={p.id}>
            {p.component}
            {i < visiblePanels.length - 1 && (
              <PanelResizeHandle className="w-4 bg-gray-200 flex justify-center items-center hover:bg-gray-300 cursor-col-resize rounded-md">
                <DragHandleDots2Icon />
              </PanelResizeHandle>
            )}
          </React.Fragment>
        ))}
      </PanelGroup>
    </div>
  );
}
