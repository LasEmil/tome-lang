import { PlayIcon, RotateCcwIcon } from "lucide-react";
import { ButtonGroup } from "./ui/button-group.tsx";
import { Button } from "./ui/button.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip.tsx";
import { useDiagnosticStore } from "../lib/state.ts";
import { MarkerSeverity } from "../../dsl/types.ts";
import { cn } from "../lib/utils.ts";
import type { Runtime } from "../hooks/useSimpleRuntime.ts";
import { SquareIcon } from "@radix-ui/react-icons";

type PlayControlsProps = {
  runtime: Runtime;
};
export default function PlayControls({ runtime }: PlayControlsProps) {
  console.log(runtime);
  const canPlay = useDiagnosticStore(
    (state) =>
      state.diagnostics.filter((d) => d.severity === MarkerSeverity.Error)
        .length === 0,
  );
  const handlePlay = () => {
    runtime.init();
  };

  const handleStop = () => {
    runtime.stop();
  };

  const handleRestart = () => {
    runtime.restart();
  };
  return (
    <ButtonGroup>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handlePlay}
            variant="ghost"
            size="icon"
            disabled={!canPlay || runtime.initialized}
            className={cn(
              "cursor-pointer text-green-600",
              !canPlay && "text-red-400 opacity-50",
            )}
          >
            <PlayIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Play script</p>
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handleRestart}
            variant="ghost"
            size="icon"
            disabled={!canPlay || !runtime.initialized}
            className={cn(
              "cursor-pointer",
              !canPlay && "text-red-400 opacity-50",
            )}
          >
            <RotateCcwIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Restart script</p>
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handleStop}
            variant="ghost"
            size="icon"
            disabled={!canPlay}
            className={cn(
              "cursor-pointer",
              !canPlay && "text-red-400 opacity-50",
            )}
          >
            <SquareIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Stop script</p>
        </TooltipContent>
      </Tooltip>
    </ButtonGroup>
  );
}
