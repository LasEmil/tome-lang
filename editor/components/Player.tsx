import { useSimpleRuntime } from "../hooks/useSimpleRuntime.ts";

export default function Player() {
  const { handleChoice, dialogue, choices, variables, isFinished } =
    useSimpleRuntime();
  console.log({ dialogue, choices, variables, isFinished });
  return <div>Player Component</div>;
}
