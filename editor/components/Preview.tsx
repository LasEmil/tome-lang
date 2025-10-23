import { useRef } from "react";
import { useNodeNetworkStore } from "../lib/state.ts";
import { Spinner } from "./ui/spinner.tsx";
import { useDimenstions } from "../hooks/useDimensions.ts";

export default function Preview() {
  const ref = useRef<HTMLDivElement>(null);
  const dimentions = useDimenstions(ref);
  const network = useNodeNetworkStore((state) => state.network);
  const loading = useNodeNetworkStore((state) => state.loading);

  return (
    <div className="h-full w-full" ref={ref}>
      Dimensions: {dimentions?.width} x {dimentions?.height}
      {loading && <Spinner />}
    </div>
  );
}
