; Keywords
([
    "node"
    "end"
    "say"
    "choice"
    "goto"
    "if"
] @keyword)

; Operators
([
    "="
    "+="
    "-="
    "*="
    "/="
    "!"
    "*"
    "/"
    "+"
    "-"
    "=="
    "!="
    ">"
    ">="
    "<"
    "<="
    "&&"
    "||"
] @operator)

; Punctuation
([
    ","
    ":"
    "("
    ")"
] @punctuation.bracket)

(interpolation
  (interpolation_start) @punctuation.special
  (expression) @embedded                   ; <-- Moved this up
  (interpolation_end) @punctuation.special   ; <-- Moved this down
)

; Literals
(string_literal) @string
(number_literal) @number
(boolean_literal) @boolean
(escape_sequence) @string.escape

; Variables
(variable
  "@" @operator
  (identifier) @variable)

; Function calls
(function_call
  name: (identifier) @function)

; Comments
(comment) @comment

; Node definitions and references
(node_definition
  name: (identifier) @constructor)

(node_reference
  target: (identifier) @constructor)
