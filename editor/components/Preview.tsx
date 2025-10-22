import { useNodeStore } from "../lib/state.ts";
import { Spinner } from "./ui/spinner.tsx";

export default function Preview() {
  const nodes = useNodeStore(state => state.nodes);
  const loading = useNodeStore(state => state.loading);
  console.log("Nodes in Preview:", nodes);
  return <div>
    {loading && <Spinner/>}
    Preview Panel
  </div>;
}
