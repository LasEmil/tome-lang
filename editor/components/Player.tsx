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
import { TypeAnimation } from "react-type-animation";
import { useEffect, useState } from "react";

type PlayerProps = {
  runtime: Runtime;
};

export default function Player({ runtime }: PlayerProps) {
  const { dialogue, choices, initialized } = runtime;
  const canPlay = useDiagnosticStore(
    (state) =>
      state.diagnostics.filter((d) => d.severity === MarkerSeverity.Error)
        .length === 0,
  );
  const [doneTyping, setDoneTyping] = useState(false);

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

  return (
    <div className="p-4">
      {dialogue ? (
        <Dialogues dialogue={dialogue} setDoneTyping={setDoneTyping} />
      ) : null}
      {choices && doneTyping ? (
        <Choices choices={choices} handleChoice={runtime.handleChoice} />
      ) : null}
    </div>
  );
}

function Dialogues({
  dialogue,
  setDoneTyping,
}: {
  dialogue: Runtime["dialogue"];
  setDoneTyping: (done: boolean) => void;
}) {
  const [cursor, setCursor] = useState(true);
  const lines = dialogue?.join("\n") ?? "";

  // Create a key based on dialogue content to force remount
  const dialogueKey = lines;

  useEffect(() => {
    setDoneTyping(false);
    setCursor(true);
  }, [dialogueKey]); // Reset when dialogue changes

  return (
    <div className="w-full text-center py-8 px-4 text-lg font-serif">
      <TypeAnimation
        key={dialogueKey} // Force remount when dialogue changes
        style={{ whiteSpace: "pre-line" }}
        speed={80}
        cursor={cursor}
        sequence={[
          lines,
          500,
          () => {
            console.log("done typing");
            setCursor(false);
            setDoneTyping(true);
          },
        ]}
      />
    </div>
  );
}

function Choices({
  choices,
  handleChoice,
}: {
  choices: Runtime["choices"];
  handleChoice: (index: number) => void;
}) {
  return (
    <div className="flex flex-col space-y-2">
      {choices?.map((choice, index) => (
        <Button
          variant="outline"
          key={choice.index}
          className="cursor-pointer animate-fadeInDown opacity-0"
          style={{
            animationDelay: `${index * 100}ms`,
            animationFillMode: "forwards",
          }}
          onClick={() => {
            handleChoice(choice.index);
          }}
        >
          {choice.text}
        </Button>
      ))}

      <style>{`
        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeInDown {
          animation: fadeInDown 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
