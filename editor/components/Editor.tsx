import { useRef } from "react";
import { useMonaco } from "../hooks/useMonaco.ts";

export default function Editor() {
  const ref = useRef<HTMLDivElement>(null);
  const editor = useMonaco(ref);
  console.log(editor)

  return <div ref={ref}/>
}
