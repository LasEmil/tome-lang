import { flavors } from "@catppuccin/palette";
import { monaco } from "./monaco.ts";

const flavor = flavors.mocha;

const baseTheme = {
  base: "vs-dark",
  inherit: true,
  rules: [
    {
      foreground: flavor.colors.overlay2.hex.substring(1),
      token: "comment",
    },
    {
      foreground: flavor.colors.text.hex.substring(1),
      token: "variable",
    },
    {
      foreground: flavor.colors.text.hex.substring(1),
      token: "entity.name.tag",
    },
    {
      foreground: flavor.colors.text.hex.substring(1),
      token: "entity.other.attribute-name",
    },
    {
      foreground: flavor.colors.pink.hex.substring(1),
      token: "string.regexp",
    },
    {
      foreground: flavor.colors.teal.hex.substring(1),
      token: "string.other.link",
    },
    {
      foreground: flavor.colors.peach.hex.substring(1),
      token: "constant.numeric",
    },
    {
      foreground: flavor.colors.peach.hex.substring(1),
      token: "constant.language",
    },
    {
      foreground: flavor.colors.peach.hex.substring(1),
      token: "constant.character",
    },
    {
      foreground: flavor.colors.peach.hex.substring(1),
      token: "support.constant",
    },
    {
      foreground: flavor.colors.red.hex.substring(1),
      token: "variable.language",
    },
    {
      foreground: flavor.colors.yellow.hex.substring(1),
      token: "entity.name.class",
    },
    {
      foreground: flavor.colors.yellow.hex.substring(1),
      token: "entity.name.type",
    },
    {
      foreground: flavor.colors.yellow.hex.substring(1),
      token: "support.type",
    },
    {
      foreground: flavor.colors.yellow.hex.substring(1),
      token: "support.class",
    },
    {
      foreground: flavor.colors.green.hex.substring(1),
      token: "string",
    },
    {
      foreground: flavor.colors.green.hex.substring(1),
      token: "constant.other.symbol",
    },
    {
      foreground: flavor.colors.sky.hex.substring(1),
      token: "keyword.operator",
    },
    {
      foreground: flavor.colors.blue.hex.substring(1),
      token: "entity.name.function",
    },
    {
      foreground: flavor.colors.blue.hex.substring(1),
      token: "support.function",
    },
    {
      foreground: flavor.colors.mauve.hex.substring(1),
      token: "keyword",
    },
    {
      foreground: flavor.colors.mauve.hex.substring(1),
      token: "storage",
    },
    {
      foreground: flavor.colors.mauve.hex.substring(1),
      token: "storage.type",
    },
    {
      foreground: flavor.colors.lavender.hex.substring(1),
      token: "variable.other.special",
    },
    {
      foreground: flavor.colors.red.hex.substring(1),
      token: "invalid",
    },
    {
      fontStyle: "bold",
      token: "markup.bold",
    },
    {
      fontStyle: "italic",
      token: "markup.italic",
    },
    {
      fontStyle: "strikethrough",
      token: "markup.strikethrough",
    },
    {
      foreground: flavor.colors.blue.hex.substring(1),
      fontStyle: "bold",
      token: "markup.heading",
    },
  ],
  colors: {
    "editor.background": flavor.colors.base.hex,
    "editor.foreground": flavor.colors.text.hex,
    "editor.selectionBackground": flavor.colors.surface2.hex,
    "editor.lineHighlightBackground": flavor.colors.surface0.hex,
    "editorCursor.foreground": flavor.colors.rosewater.hex,
    "editorWhitespace.foreground": flavor.colors.surface1.hex,
    "editorIndentGuide.background": flavor.colors.surface1.hex,
    "editorIndentGuide.activeBackground": flavor.colors.surface2.hex,
    "editor.findMatchBackground": `${flavor.colors.peach.hex}59`,
    "editor.findMatchHighlightBackground": `${flavor.colors.peach.hex}2f`,
    "editor.selectionHighlightBackground": `${flavor.colors.surface2.hex}4d`,
    "editorBracketMatch.background": `${flavor.colors.surface2.hex}47`,
    "editorBracketMatch.border": "#00000000",
    "activityBar.background": flavor.colors.mantle.hex,
    "sideBar.background": flavor.colors.mantle.hex,
    "list.hoverBackground": flavor.colors.surface0.hex,
    "list.activeSelectionBackground": flavor.colors.surface1.hex,
    "list.inactiveSelectionBackground": flavor.colors.mantle.hex,
    "list.focusBackground": flavor.colors.surface1.hex,
    "list.highlightForeground": flavor.colors.blue.hex,
    "editorGroupHeader.tabsBackground": flavor.colors.mantle.hex,
    "tab.inactiveBackground": flavor.colors.mantle.hex,
    "tab.activeBackground": flavor.colors.base.hex,
    "tab.border": flavor.colors.crust.hex,
    "statusBar.background": flavor.colors.mantle.hex,
    "statusBar.noFolderBackground": flavor.colors.mantle.hex,
    "statusBar.debuggingBackground": flavor.colors.peach.hex,
    "panel.background": flavor.colors.mantle.hex,
    "panel.border": flavor.colors.crust.hex,
    "titleBar.activeBackground": flavor.colors.mantle.hex,
    "titleBar.inactiveBackground": flavor.colors.mantle.hex,
  },
} as const;
export const cattppuccinMocha = monaco.editor.defineTheme("cattppuccin-mocha", baseTheme);
export const theme =  {
  monacoTreeSitter: {
    type: flavor.colors.yellow.hex,
    scope: flavor.colors.text.hex,
    function: flavor.colors.blue.hex,
    variable: flavor.colors.text.hex,
    number: flavor.colors.peach.hex,
    string: flavor.colors.green.hex,
    comment: flavor.colors.overlay2.hex,
    constant: flavor.colors.peach.hex,
    directive: flavor.colors.mauve.hex,
    control: flavor.colors.mauve.hex,
    operator: flavor.colors.sky.hex,
    modifier: flavor.colors.mauve.hex,
    punctuation: flavor.colors.overlay2.hex,
  },
  base: baseTheme
};
