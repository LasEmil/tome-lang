import { useEffect, useRef, useState } from "react";
import Parser from "web-tree-sitter";
import treeSitterWasm from "web-tree-sitter/tree-sitter.wasm?url";
import tomeWasm from "../../tree-sitter-tome/tree-sitter-tome.wasm?url";
import { text } from "../data/defaultText.ts";
import { TomeRuntime } from "../../runtime/simple/runtime.ts";
import { monaco } from "../lib/monaco.ts";
import type { DialogueFrame, UserChoice } from "../../runtime/simple/types.ts";

type RuntimeArgs = {
  shouldAutoStart?: boolean;
};

export type Runtime = {
  dialogue: string[];
  choices: DialogueFrame["choices"];
  variables: Record<string, unknown>;
  isFinished: boolean;
  handleChoice: (choiceIndex: number) => void;
  init: () => Promise<void>;
  restart: () => Promise<void>;
  stop: () => void;
  initialized: boolean;
};
export function useSimpleRuntime({ shouldAutoStart }: RuntimeArgs): Runtime {
  const [dialogue, setDialogue] = useState<DialogueFrame["dialogue"]>([]);
  const [choices, setChoices] = useState<DialogueFrame["choices"]>([]);
  const [variables, setVariables] = useState<Record<string, unknown>>({});
  const [isFinished, setIsFinished] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Use ref to store the generator so it persists across renders
  const generatorRef = useRef<Generator<
    DialogueFrame,
    void,
    UserChoice
  > | null>(null);

  const stopRuntime = () => {
    generatorRef.current = null;
    setIsFinished(true);
    setInitialized(false);
    setDialogue([]);
    setChoices([]);
    setVariables({});
  };

  const restartRuntime = async () => {
    stopRuntime();
    await initRuntime();
  };

  const initRuntime = async () => {
    const sourceText = monaco.editor
      .getModels()
      .find((model) => model.isAttachedToEditor())
      ?.getValue();
    if (!sourceText) {
      console.error("No source text found in Monaco editor.");
      return;
    }
    await Parser.init({
      locateFile() {
        return treeSitterWasm;
      },
    });
    const parser = new Parser();
    const Lang = await Parser.Language.load(tomeWasm);
    parser.setLanguage(Lang);
    const tree = parser.parse(sourceText);

    const runtime = new TomeRuntime(tree, text, {
      callbacks: {
        onVariableChange: (name, old, newVal) => {
          console.log(`${name}: ${old} → ${newVal}`);
        },
      },
    });

    // Create generator and get first frame
    generatorRef.current = runtime.execute();
    const result = generatorRef.current.next();
    setInitialized(true);

    if (!result.done) {
      setDialogue(result.value.dialogue);
      setChoices(result.value.choices);
      setVariables(result.value.variables);
    } else {
      setIsFinished(true);
    }
  };
  useEffect(() => {
    if (shouldAutoStart) {
      initRuntime();
    }
    // Initialize runtime and start dialogue
  }, []);

  const handleChoice = (choiceIndex: number) => {
    if (!generatorRef.current) return;

    // Continue the generator with user's choice
    const result = generatorRef.current.next({ choiceIndex });

    if (result.done) {
      setIsFinished(true);
      setChoices([]);
    } else {
      setDialogue(result.value.dialogue);
      setChoices(result.value.choices);
      setVariables(result.value.variables);
    }
  };

  return {
    dialogue,
    choices,
    variables,
    isFinished,
    handleChoice,
    init: initRuntime,
    initialized,
    stop: stopRuntime,
    restart: restartRuntime,
  };
}
