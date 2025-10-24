import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleXIcon,
  InfoIcon,
  MessageCircleWarningIcon,
} from "lucide-react";
import { MarkerSeverity } from "../../dsl/types.ts";
import type { Diagnostic } from "../../lsp/types.ts";
import { useDiagnosticStore } from "../lib/state.ts";
import { Badge } from "./ui/badge.tsx";
import { cva } from "class-variance-authority";
import { cn } from "../lib/utils.ts";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover.tsx";
import { Separator } from "./ui/separator.tsx";

export default function DiagnosticSummary() {
  const diagnostics = useDiagnosticStore((state) => state.diagnostics);
  // const diagnostics = [];
  console.log("Diagnostics in Summary:", diagnostics);
  const errors = diagnostics.filter((d) => d.severity === MarkerSeverity.Error);
  const warnings = diagnostics.filter(
    (d) => d.severity === MarkerSeverity.Warning,
  );
  const hints = diagnostics.filter((d) => d.severity === MarkerSeverity.Hint);
  const infos = diagnostics.filter((d) => d.severity === MarkerSeverity.Info);

  return (
    <div className="flex gap-2 text-sm">
      {diagnostics.length === 0 ? (
        <Badge
          variant="default"
          className="bg-green-50 text-green-600 border border-green-400"
        >
          <CircleCheckIcon />
          No issues found!
        </Badge>
      ) : null}
      {errors.length ? (
        <DiagnosticGroup severity={MarkerSeverity.Error} items={errors} />
      ) : null}

      {warnings.length ? (
        <DiagnosticGroup severity={MarkerSeverity.Warning} items={warnings} />
      ) : null}

      {hints.length ? (
        <DiagnosticGroup severity={MarkerSeverity.Hint} items={hints} />
      ) : null}

      {infos.length ? (
        <DiagnosticGroup severity={MarkerSeverity.Info} items={infos} />
      ) : null}
    </div>
  );
}

function severityToIcon(severity: MarkerSeverity) {
  switch (severity) {
    case MarkerSeverity.Error:
      return <CircleXIcon />;
    case MarkerSeverity.Warning:
      return <CircleAlertIcon />;
    case MarkerSeverity.Info:
      return <InfoIcon />;
    case MarkerSeverity.Hint:
      return <MessageCircleWarningIcon />;
    default:
      return <CircleXIcon />;
  }
}

function severityToLabel(severity: MarkerSeverity) {
  switch (severity) {
    case MarkerSeverity.Error:
      return "Errors";
    case MarkerSeverity.Warning:
      return "Warnings";
    case MarkerSeverity.Info:
      return "Infos";
    case MarkerSeverity.Hint:
      return "Hints";
    default:
      return "Unknown";
  }
}

const diagnosticVariants = cva("", {
  variants: {
    severity: {
      [MarkerSeverity.Error]:
        "bg-red-50 text-red-400 border border-red-200 hover:bg-red-100 transition-colors duration-200",
      [MarkerSeverity.Warning]:
        "bg-yellow-50 text-yellow-600 border border-yellow-400 hover:bg-yellow-200 transition-colors duration-200",
      [MarkerSeverity.Info]:
        "bg-blue-50 text-blue-600 border border-blue-400 hover:bg-blue-100 transition-colors duration-200",
      [MarkerSeverity.Hint]:
        "bg-green-50 text-green-600 border border-green-400 hover:bg-green-100 transition-colors duration-200",
    },
  },
});
function DiagnosticGroup({
  severity,
  items,
}: {
  severity: MarkerSeverity;
  items: Diagnostic[];
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge
          variant="destructive"
          className={cn(diagnosticVariants({ severity }), "cursor-pointer")}
        >
          {severityToIcon(severity)}
          {severityToLabel(severity)}: {items.length}
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="text-sm w-96">
        <h4 className="font-semibold mb-2">
          Found {severityToLabel(severity).toLowerCase()}: {items.length}
        </h4>
        <ul className="mt-2 max-h-64 overflow-y-auto">
          {items.map((item, index) => (
            <>
              <li key={index} className="mb-1">
                <div className="font-medium text-sm">{item.message}</div>
                <div className="flex justify-between">
                  {item.range && (
                    <div className="text-xs text-gray-500">
                      Line: {item.range.start.line + 1}, Column:{" "}
                      {item.range.start.character + 1}
                    </div>
                  )}
                  {item.source && (
                    <div className="text-xs text-gray-500">
                      Source: {item.source}
                    </div>
                  )}
                </div>
              </li>
              {index < items.length - 1 && <Separator />}
            </>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
