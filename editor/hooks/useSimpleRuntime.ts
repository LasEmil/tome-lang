import { useEffect, useRef, useState } from "react";
import Parser from "web-tree-sitter";
import treeSitterWasm from "web-tree-sitter/tree-sitter.wasm?url";
import tomeWasm from "../../tree-sitter-tome/tree-sitter-tome.wasm?url";
import { text } from "../data/defaultText.ts";
import { TomeRuntime } from "../../runtime/simple/runtime.ts";

export function useSimpleRuntime() {
  const [dialogue, setDialogue] = useState<string[]>([]);
  const [choices, setChoices] = useState<any[]>([]);
  const [variables, setVariables] = useState<Record<string, any>>({});
  const [isFinished, setIsFinished] = useState(false);

  // Use ref to store the generator so it persists across renders
  const generatorRef = useRef<Generator<any, void, any> | null>(null);
  useEffect(() => {
    const initRuntime = async () => {
      await Parser.init({
        locateFile() {
          return treeSitterWasm;
        },
      });
      const parser = new Parser();
      const Lang = await Parser.Language.load(tomeWasm);
      parser.setLanguage(Lang);
      const tree = parser.parse(text);

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

      if (!result.done) {
        setDialogue(result.value.dialogue);
        setChoices(result.value.choices);
        setVariables(result.value.variables);
      } else {
        setIsFinished(true);
      }
    };

    initRuntime();
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
  };
}
