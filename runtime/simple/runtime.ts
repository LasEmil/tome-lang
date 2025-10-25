import { ExpressionEvaluator } from "./evaluator.ts";
import { VariableStore } from "./variableStore.ts";
import type {
  ChoiceOption,
  DialogueFrame,
  RuntimeCallbacks,
  RuntimeOptions,
  RuntimeState,
  UserChoice,
} from "./types.ts";
import { RuntimeError } from "./errors.ts";
import type { SyntaxNode, Tree } from "web-tree-sitter";

export class TomeRuntime {
  private tree: Tree;
  private sourceCode: string;
  private variables: VariableStore;
  private evaluator: ExpressionEvaluator;
  private callbacks?: RuntimeCallbacks;
  private maxGotoDepth: number;
  private visitedNodes: string[] = [];
  private frameCount: number = 0;
  private nodeMap: Map<string, SyntaxNode> = new Map();

  constructor(tree: Tree, sourceCode: string, options?: RuntimeOptions) {
    this.tree = tree;
    this.sourceCode = sourceCode;
    this.maxGotoDepth = options?.maxGotoDepth ?? 100;
    if (options?.callbacks) {
      this.callbacks = options?.callbacks;
    }

    // Initialize variable store with callbacks
    this.variables = new VariableStore(
      options?.initialVariables,
      this.callbacks?.onVariableChange,
    );

    this.evaluator = new ExpressionEvaluator(this.variables, sourceCode);

    // Build node map for quick lookup
    this.buildNodeMap();

    // Validate start node exists
    const startNode = options?.startNode ?? "start";
    if (!this.nodeMap.has(startNode)) {
      throw new RuntimeError(`Start node '${startNode}' not found`);
    }
  }

  private buildNodeMap(): void {
    const rootNode = this.tree.rootNode;

    for (let i = 0; i < rootNode.childCount; i++) {
      const child = rootNode.children[i];
      if (child?.type === "node_definition") {
        const nameNode = child.childForFieldName("name");
        if (nameNode) {
          const nodeName = nameNode.text;
          this.nodeMap.set(nodeName, child);
        }
      }
    }
  }

  *execute(
    startNode: string = "start",
  ): Generator<DialogueFrame, void, UserChoice> {
    let currentNode = startNode;

    while (currentNode) {
      try {
        // Collect complete frame
        const frame = this.collectFrame(currentNode);
        this.frameCount++;

        if (frame.choices.length === 0) {
          // End node - yield final frame and exit
          yield frame;
          return;
        }

        // Yield frame and wait for user choice
        const userChoice = yield frame;

        // Validate choice
        if (
          userChoice.choiceIndex < 0 ||
          userChoice.choiceIndex >= frame.choices.length
        ) {
          throw new RuntimeError(
            `Invalid choice index: ${userChoice.choiceIndex}`,
            undefined,
            undefined,
            currentNode,
          );
        }

        // Jump to selected node
        const target = frame.choices[userChoice.choiceIndex]?.target;
        if (!target) {
          throw new RuntimeError(
            `Choice target not found for index: ${userChoice.choiceIndex}`,
            undefined,
            undefined,
            currentNode,
          );
        }
        currentNode = target;

        // Validate target node exists
        if (!this.nodeMap.has(currentNode)) {
          throw new RuntimeError(
            `Target node '${currentNode}' not found`,
            undefined,
            undefined,
            frame.nodeId,
          );
        }
      } catch (error) {
        if (this.callbacks?.onError) {
          this.callbacks.onError(error as RuntimeError);
        }
        throw error;
      }
    }
  }

  private collectFrame(startNodeId: string): DialogueFrame {
    const dialogue: string[] = [];
    const nodeHistory: string[] = [startNodeId];

    this.visitedNodes.push(startNodeId);
    this.callbacks?.onNodeEnter?.(startNodeId, this.variables.getAll());

    const nodeDefinition = this.nodeMap.get(startNodeId);
    if (!nodeDefinition) {
      throw new RuntimeError(`Node '${startNodeId}' not found`);
    }

    let gotoTarget: string | null = null;
    let hasChoices = false;

    // Process all named children (body statements)
    for (let i = 0; i < nodeDefinition.namedChildCount; i++) {
      const stmt = nodeDefinition.namedChildren[i];

      // Skip the name identifier (first named child)
      if (i === 0 && stmt?.type === "identifier") continue;

      try {
        if (stmt?.type === "say_statement") {
          const text = this.processSayStatement(stmt);
          dialogue.push(text);
          this.callbacks?.onDialogueCollected?.(text);
        } else if (stmt?.type === "assignment_statement") {
          this.processAssignment(stmt, startNodeId);
        } else if (stmt?.type === "goto_statement") {
          gotoTarget = this.processGoto(stmt);
        } else if (stmt?.type === "choice_statement") {
          hasChoices = true;
        }
      } catch (error) {
        if (error instanceof RuntimeError) {
          error.nodeId = startNodeId;
        }
        throw error;
      }
    }

    this.callbacks?.onNodeExit?.(startNodeId);

    // If goto exists and no choices, emit a frame with "continue" choice
    if (gotoTarget && !hasChoices) {
      // Validate goto target exists
      if (!this.nodeMap.has(gotoTarget)) {
        throw new RuntimeError(
          `Goto target node '${gotoTarget}' not found`,
          undefined,
          undefined,
          startNodeId,
        );
      }

      return {
        nodeId: startNodeId,
        nodeHistory,
        dialogue,
        choices: [
          {
            text: "Continue",
            target: gotoTarget,
            index: 0,
          },
        ],
        variables: this.variables.getAll(),
      };
    }

    // No goto, or choices exist - collect choices and return frame
    const choices = this.collectChoices(nodeDefinition, startNodeId);

    if (choices.length === 0 && hasChoices) {
      throw new RuntimeError(
        "All conditional choices evaluated to false, dialogue has no valid options",
        undefined,
        undefined,
        startNodeId,
      );
    }

    return {
      nodeId: startNodeId,
      nodeHistory,
      dialogue,
      choices,
      variables: this.variables.getAll(),
    };
  }

  private processSayStatement(stmt?: SyntaxNode): string {
    const stringLiteral =
      stmt?.childForFieldName("text") ||
      stmt?.children.find((c) => c.type === "string_literal");

    if (!stringLiteral) {
      throw new RuntimeError(
        "Say statement missing text",
        stmt?.startPosition.row,
        stmt?.startPosition.column,
      );
    }

    // Remove quotes
    let text = stringLiteral.text.slice(1, -1);

    // Handle escape sequences
    text = text.replace(/\\n/g, "\n").replace(/\\"/g, '"');

    // String interpolation
    text = this.evaluator.interpolateString(text);

    return text;
  }

  private processAssignment(stmt: SyntaxNode, nodeId: string): void {
    const variable =
      stmt.childForFieldName("variable") ||
      stmt.children.find((c) => c.type === "variable");
    const expression =
      stmt.childForFieldName("value") ||
      stmt.children.find((c) => c.type === "expression");

    if (!variable || !expression) {
      throw new RuntimeError(
        "Invalid assignment statement",
        stmt.startPosition.row,
        stmt.startPosition.column,
        nodeId,
      );
    }

    // Get variable name (skip '@' symbol)
    const varName = variable.children[1]?.text;
    if (!varName) {
      throw new RuntimeError(
        "Invalid variable in assignment",
        stmt.startPosition.row,
        stmt.startPosition.column,
        nodeId,
      );
    }

    // Find operator
    let operator = "=";
    for (let i = 0; i < stmt.childCount; i++) {
      const child = stmt.children[i];
      if (["+", "-", "*", "/"].some((op) => child?.text.includes(op + "="))) {
        const opText = child?.text;
        if (opText) {
          operator = opText;
        }
        break;
      }
    }

    // Evaluate expression
    const value = this.evaluator.evaluate(expression);

    // Apply operation
    if (operator === "=") {
      this.variables.set(varName, value);
    } else {
      const currentValue = this.variables.get(varName);
      let newValue: unknown;

      switch (operator) {
        case "+=":
          newValue = Number(currentValue) + Number(value);
          break;
        case "-=":
          newValue = Number(currentValue) - Number(value);
          break;
        case "*=":
          newValue = Number(currentValue) * Number(value);
          break;
        case "/=":
          if (Number(value) === 0) {
            throw new RuntimeError(
              "Division by zero",
              stmt.startPosition.row,
              stmt.startPosition.column,
              nodeId,
            );
          }
          newValue = Number(currentValue) / Number(value);
          break;
        default:
          throw new RuntimeError(
            `Unknown assignment operator: ${operator}`,
            stmt.startPosition.row,
            stmt.startPosition.column,
            nodeId,
          );
      }

      this.variables.set(varName, newValue);
    }
  }

  private processGoto(stmt: SyntaxNode): string {
    const nodeRef =
      stmt.childForFieldName("target") ||
      stmt.children.find((c) => c.type === "node_reference");

    if (!nodeRef) {
      throw new RuntimeError(
        "Goto statement missing target",
        stmt.startPosition.row,
        stmt.startPosition.column,
      );
    }

    const targetNode =
      nodeRef.childForFieldName("target") ||
      nodeRef.children.find((c) => c.type === "identifier");

    if (!targetNode) {
      throw new RuntimeError(
        "Goto target node not found",
        stmt.startPosition.row,
        stmt.startPosition.column,
      );
    }
    return targetNode.text;
  }

  private collectChoices(
    nodeDefinition: SyntaxNode,
    nodeId: string,
  ): ChoiceOption[] {
    const choices: ChoiceOption[] = [];
    let choiceIndex = 0;

    // Iterate through named children, skipping the identifier (name)
    for (let i = 0; i < nodeDefinition.namedChildCount; i++) {
      const child = nodeDefinition.namedChildren[i];

      // Skip the name identifier
      if (i === 0 && child?.type === "identifier") continue;

      if (child?.type === "choice_statement") {
        const choice = this.processChoice(child, nodeId);

        if (choice) {
          choices.push({
            ...choice,
            index: choiceIndex++,
          });
        }
      }
    }

    return choices;
  }

  private processChoice(
    stmt: SyntaxNode,
    nodeId: string,
  ): { text: string; target: string } | null {
    const textNode = stmt.childForFieldName("text");
    const nodeRef =
      stmt.childForFieldName("target") ||
      stmt.children.find((c) => c.type === "node_reference");
    const conditionClause = stmt.children.find(
      (c) => c.type === "condition_clause",
    );

    if (!textNode || !nodeRef) {
      throw new RuntimeError(
        "Choice statement missing text or target",
        stmt.startPosition.row,
        stmt.startPosition.column,
        nodeId,
      );
    }

    // Check condition if exists
    if (conditionClause) {
      const conditionExpr = conditionClause.childForFieldName("condition");
      if (conditionExpr) {
        const result = this.evaluator.evaluate(conditionExpr);
        if (!result) {
          return null; // Condition false, skip this choice
        }
      }
    }

    // Remove quotes from text
    const text = textNode.text
      .slice(1, -1)
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"');

    // Get target node name
    const targetNode =
      nodeRef.childForFieldName("target") ||
      nodeRef.children.find((c) => c.type === "identifier");
    if (!targetNode) {
      throw new RuntimeError(
        "Choice target node not found",
        stmt.startPosition.row,
        stmt.startPosition.column,
        nodeId,
      );
    }
    const target = targetNode.text;

    return { text, target };
  }

  // State management for save/load
  getState(): RuntimeState {
    return {
      variables: this.variables.getAll(),
      visitedNodes: [...this.visitedNodes],
      frameCount: this.frameCount,
    };
  }

  setState(state: RuntimeState): void {
    this.variables.setState(state.variables);
    this.visitedNodes = [...state.visitedNodes];
    this.frameCount = state.frameCount;
  }

  // Utility methods
  getVariables(): Record<string, unknown> {
    return this.variables.getAll();
  }

  getVariable(name: string): unknown {
    return this.variables.get(name);
  }

  setVariable(name: string, value: unknown): void {
    this.variables.set(name, value);
  }

  getVisitedNodes(): string[] {
    return [...this.visitedNodes];
  }

  getFrameCount(): number {
    return this.frameCount;
  }
}
