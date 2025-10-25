import type { Runtime } from "../hooks/useSimpleRuntime.ts";
import DiagnosticSummary from "./DiagnosticSummary.tsx";
import { Menu } from "./Menu.tsx";
import PlayControls from "./PlayControls.tsx";

type HeaderProps = {
  runtime: Runtime;
};
export default function Header({ runtime }: HeaderProps) {
  return (
    <header className="px-4 py-2 grid grid-cols-3 items-center bg-gradient-to-r from-slate-50 to-slate-100 mb-2 rounded-md shadow">
      <div className="flex items-center gap-4">
        tome
        <Menu />
      </div>
      <div className="flex justify-center">
        <DiagnosticSummary />
      </div>
      <div className="flex justify-end">
        <PlayControls runtime={runtime} />
      </div>
    </header>
  );
}
