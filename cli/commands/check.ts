import { command } from "cleye";
import { AggregateLexerError, Lexer } from "../../dsl/lexer.ts";
import { AggregateParserError, Parser } from "../../dsl/parser.ts";
import { Analyzer } from "../../dsl/analyzer.ts";
import { SeverityLevels, type SeverityLevel } from "../../dsl/types.ts";
import { createStyler, prettyPrintAnalysisResults } from "../format.ts";
import fs from "node:fs/promises";

async function readEntireFile(filePath: string) {
  const fileHandle = await fs.open(filePath, "r");
  const buffer = await fileHandle.readFile({ encoding: "utf-8" });

  return { buffer, close: () => fileHandle.close() };
}

function Severity(level: SeverityLevel): SeverityLevel {
  if (!SeverityLevels.includes(level)) {
    throw new Error(`Invalid level: "${level}"`);
  }

  return level;
}

export async function check(
  files: string[],
  flags: { format: string; level: string; noColor: boolean },
) {
  const { format, level, noColor } = flags;
  const style = createStyler(noColor);
  let closeFile;

  for (const filePath of files) {
    try {
      const { buffer, close } = await readEntireFile(filePath);
      closeFile = close;

      const fileContent = buffer.toString();

      const lexer = new Lexer(fileContent);
      const lexResult = lexer.lex();

      if (!lexResult.valid) {
        switch (format) {
          case "text":
            throw new AggregateLexerError(lexResult.errors);
          case "json":
            console.log(
              JSON.stringify(
                {
                  type: "lexical_errors",
                  file: filePath,
                  errors: lexResult.errors.map((err) => ({
                    line: err.line,
                    column: err.column,
                    message: err.message,
                  })),
                },
                null,
                2,
              ),
            );
        }
        return;
      }
      const parser = new Parser(lexResult.value.values(), fileContent);

      const parseResult = parser.parse();
      if (!parseResult.valid) {
        switch (format) {
          case "text":
            throw new AggregateParserError(parseResult.errors);
          case "json":
            console.log(
              JSON.stringify(
                {
                  type: "syntax_errors",
                  file: filePath,
                  errors: parseResult.errors.map((err) => ({
                    line: err.line,
                    column: err.column,
                    message: err.message,
                  })),
                },
                null,
                2,
              ),
            );
        }
        return;
      }

      const analyzer = new Analyzer();
      if (parseResult.value) {
        for (const node of parseResult.value.nodes) {
          analyzer.analyzeNode(node);
        }
      }
      const analysisResult = analyzer.finalizeAnalysis();

      if (!analysisResult.valid) {
        switch (format) {
          case "text":
            prettyPrintAnalysisResults(
              analysisResult,
              filePath,
              style,
              level as SeverityLevel,
            );
            break;
          case "json":
            console.log(
              JSON.stringify(
                {
                  type: "analysis_issues",
                  file: filePath,
                  errors: analysisResult.errors,
                  warnings: analysisResult.warnings,
                  suggestions: analysisResult.suggestions,
                },
                null,
                2,
              ),
            );
            break;
        }
      } else {
        console.log(
          style(
            "green",
            `Analysis of ${filePath} completed successfully. No issues found.`,
          ),
        );
      }
    } catch (error) {
      if (
        error instanceof AggregateParserError ||
        error instanceof AggregateLexerError
      ) {
        for (const parseError of error.errors) {
          const locationPrefix = style(
            "cyan",
            `${filePath}:${parseError.line}:${parseError.column}:`,
          );
          const errorLabel = style("red", "error:");
          console.error(
            `${locationPrefix} ${errorLabel} ${parseError.message}`,
          );
        }
      } else if (error instanceof Error) {
        console.error(
          `${style("red", "Error")} reading file ${filePath}: ${error.message}`,
        );
      } else {
        console.error(`Error reading file ${filePath}:`, error);
      }
      continue;
    } finally {
      if (closeFile) {
        await closeFile();
      }
    }
  }
}
export const checkCommand = command(
  {
    name: "check",
    help: {
      description: "Analyze .tome files for errors, warnings, and suggestions",
    },
    parameters: ["<files...>"],
    flags: {
      format: {
        type: String,
        alias: "f",
        description: "Output format: text (default) or json",
        default: "text",
      },
      level: {
        type: Severity,
        alias: "l",
        description:
          "Minimum diagnostic level: error (default), warning, or info",
        default: "error",
      },
      noColor: {
        type: Boolean,
        description: "Disable colorized text output",
        default: false,
      },
    },
  },
  async (argv) => {
    const files = argv._.files as string[];
    const { format, level, noColor } = argv.flags;
    await check(files, { format, level, noColor });
  },
);
