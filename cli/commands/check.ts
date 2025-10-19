import { command } from "cleye";
import { promises } from "node:fs";
import { AggregateLexerError, Lexer } from "../../dsl/lexer.ts";
import { AggregateParserError, Parser } from "../../dsl/parser.ts";
import { Analyzer } from "../../dsl/analyzer.ts";
import { SeverityLevels, type SeverityLevel } from "../../dsl/types.ts";
import { createStyler, prettyPrintAnalysisResults } from "../format.ts";

function readEntireFile(filePath: string): Promise<string | Buffer> {
  return promises
    .open(filePath, "r")
    .then((fileHandle) => fileHandle.readFile());
}

function Severity(level: SeverityLevel) {
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

  for (const filePath of files) {
    try {
      const buffer = await readEntireFile(filePath);
      const fileContent = buffer.toString();

      const lexer = new Lexer(fileContent);
      const lexResult = lexer.lex();

      if (!lexResult.valid) {
        throw new AggregateLexerError(lexResult.errors);
      }
      const parser = new Parser(lexResult.value.values(), fileContent);

      const parseResult = parser.parse();
      if (!parseResult.valid) {
        throw new AggregateParserError(parseResult.errors);
      }

      const analyzer = new Analyzer();
      if (parseResult.value) {
        for (const node of parseResult.value.nodes) {
          analyzer.analyzeNode(node);
        }
      }
      const analysisResult = analyzer.finalizeAnalysis();

      if (!analysisResult.valid) {
        prettyPrintAnalysisResults(
          analysisResult,
          filePath,
          style,
          level as SeverityLevel,
        );
      } else {
        console.log(analysisResult);
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

    console.log("Files:", files);
    console.log("Flags:", { format, level, noColor });
  },
);
