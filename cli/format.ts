import { styleText } from "node:util";
import type { AnalysisResult } from "../dsl/types.ts";

export function createStyler(noColor: boolean) {
  return function style(
    format: Parameters<typeof styleText>[0],
    text: string,
  ): string {
    if (noColor) {
      return text;
    }
    return styleText(format, text);
  };
}

export function prettyPrintAnalysisResults(
  result: AnalysisResult,
  filePath: string,
  style: ReturnType<typeof createStyler>,
  level: string,
): void {
  const diagnostics: Array<{
    line: number;
    column: number;
    message: string;
    severity: "error" | "warning" | "info";
  }> = [];

  diagnostics.push(
    ...result.errors.map((e) => ({
      line: e.line,
      column: e.column,
      message: e.message,
      severity: "error" as const,
    })),
  );

  if (level === "warning" || level === "info") {
    diagnostics.push(
      ...result.warnings.map((w) => ({
        line: w.line,
        column: w.column,
        message: w.message,
        severity: "warning" as const,
      })),
    );
  }

  if (level === "info") {
    if (!result.suggestions) return;
    diagnostics.push(
      ...result.suggestions.map((s) => ({
        line: s.line,
        column: s.column,
        message: s.message,
        severity: "info" as const,
      })),
    );
  }

  const maxLocationWidth = diagnostics.reduce((max, d) => {
    const location = `${filePath}:${d.line}:${d.column}:`;
    return Math.max(max, location.length);
  }, 0);

  for (const diagnostic of diagnostics) {
    const location = `${filePath}:${diagnostic.line}:${diagnostic.column}:`;
    const padding = " ".repeat(maxLocationWidth - location.length);
    const locationPrefix = style("cyan", location);

    let label: string;
    switch (diagnostic.severity) {
      case "error":
        label = style("red", "error:");
        break;
      case "warning":
        label = style("yellow", "warning:");
        break;
      case "info":
        label = style("blue", "info:");
        break;
    }

    const output = `${locationPrefix}${padding} ${label} ${diagnostic.message}`;

    if (diagnostic.severity === "info") {
      console.log(output);
    } else {
      console.error(output);
    }
  }
}
