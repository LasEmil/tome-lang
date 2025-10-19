import { cli } from "cleye";
import { checkCommand } from "./commands/check.ts";
import { compileCommand } from "./commands/compile.ts";
import { playCommand } from "./commands/play.ts";

cli({
  name: "tome",
  version: "1.0.0",
  help: {
    description:
      "Tome CLI - A tool for checking, compiling, and testing dialogue scripts",
  },
  commands: [checkCommand, compileCommand, playCommand],
});
