import { text } from "../data/defaultText.ts";
import { useCodeMirror } from "../hooks/useCodeMirror.ts";

export default function Editor() {
  const ref = useCodeMirror({ defaultText: text });

  return <div ref={ref} />;
}
