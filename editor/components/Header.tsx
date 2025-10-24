import DiagnosticSummary from "./DiagnosticSummary.tsx";
import { Menu } from "./Menu.tsx";

export default function Header() {
  return (
    <header className="px-4 py-2 grid grid-cols-3 items-center bg-gradient-to-r from-slate-50 to-slate-100 mb-2 rounded-md shadow">
      <div className="flex items-center gap-4">
        tome
        <Menu />
      </div>
      <div className="flex justify-center">
        <DiagnosticSummary />
      </div>
      <div className="flex justify-end">Node Info</div>
    </header>
  );
}
