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
        description: "Output format: json (default), state machine or csv",
        default: "json",
      },
      pretty: {
        type: Boolean,
        alias: "p",
        description: "Format JSON output with indentation",
        default: false,
      },
    },
  },
  (argv) => {
    const file = argv._.file as string;
    const { output, format, pretty } = argv.flags;

    // TODO: Implement compile command
    console.log("Compile command called");
    console.log("File:", file);
    console.log("Flags:", { output, format, pretty });
  },
);
