import { command } from "cleye";

export const playCommand = command(
  {
    name: "play",

    help: {
      description:
        "Launch interactive simulator to play through a dialogue script",
    },

    parameters: ["<file>"],

    flags: {
      startNode: {
        type: String,
        alias: "s",
        description: "Begin simulation at specified node ID",
      },
    },
  },
  (argv) => {
    const file = argv._.file as string;
    const { startNode } = argv.flags;

    // TODO: Implement play command
    console.log("Play command called");
    console.log("File:", file);
    console.log("Flags:", { startNode });
  },
);
