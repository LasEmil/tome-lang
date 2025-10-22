import {  useRef } from "react";
import { useNodeNetworkStore } from "../lib/state.ts";
import { Spinner } from "./ui/spinner.tsx";

export default function Preview() {
  const ref = useRef<HTMLDivElement>(null);
  const network = useNodeNetworkStore(state => state.network);
  const loading = useNodeNetworkStore(state => state.loading);

  console.log("Network in Preview:", network);
  return <div className="h-full w-full" ref={ref}>
    {loading && <Spinner/>}
  </div>;
}
