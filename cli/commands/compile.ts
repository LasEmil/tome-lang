import { command } from "cleye";

export const compileCommand = command(
  {
    name: "compile",

    help: {
      description: "Transform a .tome script into machine-readable format",
    },

    parameters: ["<file>"],

    flags: {
      output: {
        type: String,
        alias: "o",
        description: "File path to write the output to",
      },
      format: {
        type: String,
        alias: "f",
        description: "Output format: json (default), xstate, csv, or dot",
        default: "json",
      },
      pretty: {
        type: Boolean,
        alias: "p",
        description: "Format JSON output with indentation",
        default: false,
      },
      tokens: {
        type: Boolean,
        description: "Debug flag: Output lexer token stream",
        default: false,
      },
    },
  },
  (argv) => {
    const file = argv._.file as string;
    const { output, format, pretty, tokens } = argv.flags;

    // TODO: Implement compile command
    console.log("Compile command called");
    console.log("File:", file);
    console.log("Flags:", { output, format, pretty, tokens });
  },
);
