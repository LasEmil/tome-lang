import { CircleOffIcon } from "lucide-react";
import { type Runtime } from "../hooks/useSimpleRuntime.ts";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "./ui/empty.tsx";
import { Button } from "./ui/button.tsx";
import { useDiagnosticStore } from "../lib/state.ts";
import { MarkerSeverity } from "../../dsl/types.ts";

type PlayerProps = {
  runtime: Runtime;
};
export default function Player({ runtime }: PlayerProps) {
  const { dialogue, initialized } = runtime;
  const canPlay = useDiagnosticStore(
    (state) =>
      state.diagnostics.filter((d) => d.severity === MarkerSeverity.Error)
        .length === 0,
  );
  console.log("Player runtime:", runtime);
  if (!initialized) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CircleOffIcon />
          </EmptyMedia>
          <EmptyTitle>No scene is playing</EmptyTitle>
          <EmptyDescription>
            Start the script to see the dialogue here.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex">
            <Button
              className="cursor-pointer"
              onClick={() => runtime.init()}
              disabled={!canPlay}
            >
              Start current scene
            </Button>
          </div>
        </EmptyContent>
      </Empty>
    );
  }
  return <div>{dialogue ? <Dialogues dialogue={dialogue} /> : null}</div>;
}

function Dialogues({ dialogue }: { dialogue: Runtime["dialogue"] }) {
  return (
    <div>
      {dialogue.map((line, index) => (
        <p key={index} className="mb-2">
          {line}
        </p>
      ))}
    </div>
  );
}
