import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { DragHandleDots2Icon } from "@radix-ui/react-icons";
import Editor from "./Editor.tsx";

export default function App() {
  return (
    <div className="h-screen w-screen">
      <PanelGroup direction="horizontal">
        <Panel defaultSize={30} minSize={20}>
          <Editor />
        </Panel>
        <PanelResizeHandle className="w-[0.5rem] bg-gray-200 flex justify-center items-center hover:bg-gray-300 cursor-col-resize">
          <DragHandleDots2Icon />
        </PanelResizeHandle>
        <Panel minSize={30}>Preview</Panel>
        <PanelResizeHandle className="w-[0.5rem] bg-gray-200 flex justify-center items-center hover:bg-gray-300 cursor-col-resize">
          <DragHandleDots2Icon />
        </PanelResizeHandle>
        <Panel defaultSize={30} minSize={20}>
          Player
        </Panel>
      </PanelGroup>
    </div>
  );
}
