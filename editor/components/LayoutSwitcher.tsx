import {
  Columns2,
  Columns3,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { ToggleGroup } from "./ui/toggle-group.tsx";
import LayoutButton from "./LayoutButton.tsx";
import { useLayoutState } from "../lib/state.ts";

export function LayoutSwitcher() {
  const panelsState = useLayoutState((state) => state.panels);
  const panels = Object.keys(panelsState).filter(
    (key) => panelsState[key]?.value,
  );
  const updatePanels = useLayoutState((state) => state.updatePanels);

  return (
    <ToggleGroup
      type="multiple"
      variant="outline"
      value={panels}
      onValueChange={(value) => {
        if (value) updatePanels(value);
      }}
    >
      <LayoutButton
        name="editor"
        iconOn={PanelLeftClose}
        iconOff={PanelLeftOpen}
      />

      <LayoutButton name="preview" iconOn={Columns3} iconOff={Columns2} />

      <LayoutButton
        name="player"
        iconOn={PanelRightClose}
        iconOff={PanelRightOpen}
      />
    </ToggleGroup>
  );
}
