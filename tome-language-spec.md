# Tome Language Specification

## Project Overview

**Tome** is a dialogue scripting language and editor for game developers. It features:
- Ruby-inspired syntax for writing branching dialogues
- TypeScript/Node.js parser that generates an AST
- XState integration for dialogue state management
- D3.js visualization of dialogue graphs
- Built-in variable system with conditionals

## Project Structure

```
tome/
├── parser/          # TypeScript CLI parser
│   ├── lexer.ts
│   ├── parser.ts
│   ├── validator.ts
│   └── cli.ts
└── editor/          # Web-based editor (future)
    ├── index.html
    └── ...
```

## Language Syntax

### Node Definition

```ruby
node node_name
  # statements go here
end
```

### Variables

Variables are prefixed with `@`:

```ruby
@gold = 100
@met_npc = true
@player_name = "Aria"
```

**Supported types:**
- Numbers: `100`, `45.6`
- Booleans: `true`, `false`
- Strings: `"hello world"`

**Operations:**
```ruby
@gold = 100        # assignment
@gold += 50        # increment
@gold -= 25        # decrement
@gold *= 2         # multiply
@gold /= 2         # divide
@count = @gold + 10  # expressions
```

### Dialogue

```ruby
say "Hello, adventurer!"
say "You have #{@gold} gold pieces."  # string interpolation
```

**String interpolation:** Use `#{@variable}` to embed variables in strings.

### Choices

```ruby
choice "Buy sword", :shop
choice "Buy potion", :shop, if: @gold >= 50
choice "VIP area", :vip, if: @reputation > 10 && @met_npc == true
```

**Syntax:** `choice "text", :target_node, if: condition`
- `if:` clause is optional
- Target must be a symbol (`:node_name`)

### Goto

Auto-transition to another node without user choice:

```ruby
goto :next_node
```

### Random Function

```ruby
@gold = random(10, 50)           # random number between 10-50 (inclusive)
@damage = random(1, 6) * @strength
```

### Conditionals

**Comparison operators:**
- `==` equal
- `!=` not equal
- `>` greater than
- `<` less than
- `>=` greater or equal
- `<=` less or equal

**Logical operators:**
- `&&` and
- `||` or
- `!` not

**Examples:**
```ruby
if: @gold >= 50
if: @reputation > 10 && @met_npc == true
if: @has_key == true || @lockpick_skill >= 5
if: !@seen_intro
```

### Comments

```ruby
# This is a comment
node start
  # Comments can appear anywhere
  say "Hello!"
end
```

### Complete Example

```ruby
node start
  say "Greetings, Warrior of Light!"
  say "You have #{@gold} gold."
  
  @met_merchant = true
  
  choice "Ask about quests", :quests
  choice "Visit shop", :shop, if: @gold >= 10
  choice "Leave", :exit
end

node shop
  say "Welcome to my shop!"
  say "That sword costs 50 gold."
  
  choice "Buy sword", :buy_sword, if: @gold >= 50
  choice "Back", :start
end

node buy_sword
  @gold -= 50
  @has_sword = true
  @reputation += 1
  
  say "Pleasure doing business!"
  
  goto :start
end

node quests
  say "I have a delivery quest for you."
  @gold += random(10, 30)
  
  choice "Return to start", :start
end

node exit
  say "Safe travels!"
  # No choices = end node
end
```

## Token Types

Complete list of tokens the lexer must recognize:

```typescript
type TokenType = 
  // Keywords
  | 'NODE'
  | 'SAY'
  | 'CHOICE'
  | 'GOTO'
  | 'IF'
  | 'END'
  | 'RANDOM'
  
  // Identifiers and Literals
  | 'IDENTIFIER'      // variable names, node names
  | 'NUMBER'          // 123, 45.6
  | 'STRING'          // "hello world"
  | 'TRUE'            // true
  | 'FALSE'           // false
  
  // Symbols
  | 'AT_SIGN'         // @
  | 'COLON'           // :
  | 'COMMA'           // ,
  | 'LEFT_PAREN'      // (
  | 'RIGHT_PAREN'     // )
  
  // Operators
  | 'EQUALS'          // =
  | 'PLUS_EQUALS'     // +=
  | 'MINUS_EQUALS'    // -=
  | 'STAR_EQUALS'     // *=
  | 'SLASH_EQUALS'    // /=
  
  // Comparison
  | 'EQUALS_EQUALS'   // ==
  | 'NOT_EQUALS'      // !=
  | 'GREATER'         // >
  | 'GREATER_EQUALS'  // >=
  | 'LESS'            // <
  | 'LESS_EQUALS'     // <=
  
  // Logical
  | 'AND'             // &&
  | 'OR'              // ||
  | 'NOT'             // !
  
  // Arithmetic (for expressions)
  | 'PLUS'            // +
  | 'MINUS'           // -
  | 'STAR'            // *
  | 'SLASH'           // /
  
  // Whitespace/Structure
  | 'NEWLINE'         // \n
  | 'INDENT'          // increased indentation
  | 'DEDENT'          // decreased indentation
  | 'EOF'             // end of file

interface Token {
  type: TokenType;
  value: string | number;
  line: number;
  column: number;
}
```

## Grammar Rules

Formal grammar for the parser:

```
Program = Node+

Node = NODE IDENTIFIER NEWLINE INDENT Statement+ DEDENT END

Statement = 
  | Assignment
  | Say
  | Choice
  | Goto

Assignment = AT_SIGN IDENTIFIER Operator Expression NEWLINE

Operator = EQUALS | PLUS_EQUALS | MINUS_EQUALS | STAR_EQUALS | SLASH_EQUALS

Say = SAY STRING NEWLINE

Choice = CHOICE STRING COMMA COLON IDENTIFIER (COMMA IF COLON Expression)? NEWLINE

Goto = GOTO COLON IDENTIFIER NEWLINE

Expression = LogicalOr

LogicalOr = LogicalAnd (OR LogicalAnd)*

LogicalAnd = Comparison (AND Comparison)*

Comparison = Term (ComparisonOp Term)?

ComparisonOp = EQUALS_EQUALS | NOT_EQUALS | GREATER | GREATER_EQUALS | LESS | LESS_EQUALS

Term = Factor ((PLUS | MINUS) Factor)*

Factor = Unary ((STAR | SLASH) Unary)*

Unary = NOT Unary | Primary

Primary = 
  | NUMBER
  | STRING
  | TRUE
  | FALSE
  | AT_SIGN IDENTIFIER
  | IDENTIFIER LEFT_PAREN (Expression (COMMA Expression)*)? RIGHT_PAREN  // function call
  | LEFT_PAREN Expression RIGHT_PAREN
```

## AST Structure

Target AST format (TypeScript interfaces):

```typescript
interface AST {
  type: 'Program';
  nodes: DialogueNode[];
}

interface DialogueNode {
  type: 'Node';
  id: string;
  statements: Statement[];
  line: number;
}

type Statement = 
  | AssignmentStatement
  | SayStatement
  | ChoiceStatement
  | GotoStatement;

interface AssignmentStatement {
  type: 'Assignment';
  variable: string;
  operator: '=' | '+=' | '-=' | '*=' | '/=';
  value: Expression;
  line: number;
}

interface SayStatement {
  type: 'Say';
  text: string;
  interpolations: Interpolation[];
  line: number;
}

interface Interpolation {
  expression: Expression;
  start: number;  // position in string
  end: number;
}

interface ChoiceStatement {
  type: 'Choice';
  text: string;
  target: string;
  condition?: Expression;
  line: number;
}

interface GotoStatement {
  type: 'Goto';
  target: string;
  line: number;
}

type Expression =
  | LiteralExpression
  | VariableExpression
  | BinaryExpression
  | UnaryExpression
  | FunctionCallExpression;

interface LiteralExpression {
  type: 'Literal';
  value: string | number | boolean;
}

interface VariableExpression {
  type: 'Variable';
  name: string;
}

interface BinaryExpression {
  type: 'BinaryOp';
  operator: string;
  left: Expression;
  right: Expression;
}

interface UnaryExpression {
  type: 'UnaryOp';
  operator: string;
  operand: Expression;
}

interface FunctionCallExpression {
  type: 'FunctionCall';
  name: string;
  args: Expression[];
}
```

## Parser Implementation Strategy

### 1. Lexer (Tokenizer)

**Purpose:** Convert source text into tokens.

**Key responsibilities:**
- Character-by-character scanning
- Track line and column numbers
- Recognize keywords vs identifiers
- Handle indentation (INDENT/DEDENT tokens)
- Skip comments and whitespace (except newlines and indentation)

**Indentation handling:**
- Track current indentation level (count of spaces/tabs)
- When indentation increases: emit INDENT
- When indentation decreases: emit DEDENT (possibly multiple)
- Use a stack to track indentation levels

### 2. Parser

**Purpose:** Convert tokens into AST.

**Strategy:** Recursive descent parsing
- One function per grammar rule
- Functions consume tokens and return AST nodes
- Use helper functions: `peek()`, `advance()`, `expect(type)`

**Key functions:**
- `parse()` → Program
- `parseNode()` → DialogueNode
- `parseStatement()` → Statement
- `parseExpression()` → Expression (with precedence)
- `parseAssignment()`, `parseSay()`, `parseChoice()`, `parseGoto()`

**Expression parsing:**
Use precedence climbing:
1. Logical OR (lowest precedence)
2. Logical AND
3. Comparison (==, !=, >, <, >=, <=)
4. Addition/Subtraction
5. Multiplication/Division
6. Unary (!, -)
7. Primary (literals, variables, function calls, parentheses)

### 3. Validator

**Purpose:** Check AST for semantic errors.

**Validations:**
- All referenced nodes exist (in `choice` and `goto`)
- No duplicate node names
- A `start` node exists
- No unreachable nodes (warning)
- `random()` has exactly 2 numeric arguments
- Variables in conditions are assigned somewhere (optional for MVP)

**Output:** List of errors with line numbers

## CLI Usage

```bash
# Parse and validate
tome parse input.tome

# Output AST as JSON
tome parse input.tome --output ast.json

# Validate only
tome parse input.tome --validate

# Debug mode (show tokens)
tome parse input.tome --debug
```

## MVP Scope

### Included in MVP
- ✅ All language features above
- ✅ Lexer with full token support
- ✅ Parser generating AST
- ✅ Validator with error reporting
- ✅ CLI tool
- ✅ String interpolation
- ✅ Random function
- ✅ Conditionals

### Future Features (Post-MVP)
- Arrays and inventory system
- Multiple speakers per node
- Advanced functions (min, max, abs, etc.)
- Type checking
- Better error recovery
- IDE integration (LSP)
- Web editor with D3 visualization
- XState runtime integration

## Development Guidelines

### Best Practices
- No external dependencies for parser
- Track line/column for all tokens and AST nodes
- Provide clear error messages with context
- Test incrementally with small examples
- Build grammar features one at a time

### Error Message Format
```
Error at line 5, column 12:
  choice "Buy sword", shop
                      ^
Expected ':' before node reference
```

### Testing Strategy
1. Start with basic node parsing
2. Add variable assignments
3. Add say statements
4. Add choices without conditions
5. Add conditions
6. Add expressions
7. Add string interpolation
8. Add validation

## Example Test Cases

### Valid Input
```ruby
node start
  @gold = 100
  say "Hello!"
  choice "Continue", :next
end

node next
  say "Done!"
end
```

### Invalid Input Examples

**Missing end:**
```ruby
node start
  say "Hello!"
# Error: Expected 'end' keyword
```

**Unknown node reference:**
```ruby
node start
  choice "Go", :missing
end
# Error: Unknown node 'missing' referenced at line 2
```

**Invalid expression:**
```ruby
node start
  @gold = "hello" + 5
end
# Error: Cannot add string and number at line 2
```

## Notes

- The language is whitespace-sensitive (indentation matters)
- Node names and variable names are case-sensitive
- Keywords are lowercase
- String interpolation is parsed during the lexer phase
- All nodes must end with `end` keyword
- Empty nodes are not allowed (must have at least one statement)

## Contact & Resources

- Project name: **Tome**
- Inspired by: Final Fantasy XIV (hence the name)
- Architecture: TypeScript parser → JSON AST → XState machine → D3 visualization
