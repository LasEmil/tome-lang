import type { StreamParser } from "@codemirror/language";

// Keywords in the Tome language
const keywords = new Set([
  "node",
  "say",
  "choice",
  "goto",
  "if",
  "end",
  "random",
  "true",
  "false",
]);

interface TomeState {
  inString: boolean;
  inInterpolation: boolean;
  braceDepth: number;
}

export const tomeStreamParser: StreamParser<TomeState> = {
  startState() {
    return {
      inString: false,
      inInterpolation: false,
      braceDepth: 0,
    };
  },

  token(stream, state) {
    // Handle string interpolation state
    if (state.inString) {
      if (state.inInterpolation) {
        // We're inside an interpolation #{...}
        // Track braces to know when interpolation ends
        if (stream.match("}")) {
          state.braceDepth--;
          if (state.braceDepth === 0) {
            state.inInterpolation = false;
            return "punctuation";
          }
          return "punctuation";
        }

        if (stream.match("{")) {
          state.braceDepth++;
          return "punctuation";
        }

        // Inside interpolation, parse as normal code
        // Fall through to regular parsing below
      } else {
        // We're in a string but not in interpolation
        if (stream.match('"')) {
          state.inString = false;
          return "string";
        }

        if (stream.match("#{")) {
          state.inInterpolation = true;
          state.braceDepth = 1;
          return "punctuation";
        }

        // Consume string content
        while (!stream.eol()) {
          const ch = stream.peek();
          if (ch === '"' || (ch === "#" && stream.string[stream.pos + 1] === "{")) {
            break;
          }
          stream.next();
        }
        return "string";
      }
    }

    // Skip whitespace (except newlines which CodeMirror handles)
    if (stream.eatSpace()) {
      return null;
    }

    // Comments - # to end of line (but not #{ which is interpolation)
    if (stream.match("#") && stream.peek() !== "{") {
      stream.skipToEnd();
      return "comment";
    }

    // Strings - "text" with potential interpolation
    if (stream.match('"')) {
      state.inString = true;
      return "string";
    }

    // Variables - @variable_name
    if (stream.match("@")) {
      stream.eatWhile(/[\w_]/);
      return "variableName";
    }

    // Symbols - :node_name
    if (stream.match(":")) {
      stream.eatWhile(/[\w_]/);
      return "atom";
    }

    // Numbers - integers and floats
    if (stream.match(/^[0-9]+\.?[0-9]*/)) {
      return "number";
    }

    // Operators - multi-character first
    if (
      stream.match("==") ||
      stream.match("!=") ||
      stream.match(">=") ||
      stream.match("<=") ||
      stream.match("&&") ||
      stream.match("||") ||
      stream.match("+=") ||
      stream.match("-=") ||
      stream.match("*=") ||
      stream.match("/=")
    ) {
      return "operator";
    }

    // Single character operators
    if (stream.match(/[=<>!+\-*/]/)) {
      return "operator";
    }

    // Punctuation
    if (stream.match(/[(),{}]/)) {
      return "punctuation";
    }

    // Keywords and identifiers
    if (stream.match(/^[a-zA-Z_]\w*/)) {
      const word = stream.current();
      if (keywords.has(word)) {
        return "keyword";
      }
      return "variableName.definition";
    }

    // If nothing matches, consume one character
    stream.next();
    return null;
  },
};
