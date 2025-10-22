import type {
  AnalysisError,
  AnalysisResult,
  AnalysisSuggestion,
  AnalysisWarning,
  DialogueNode,
  Expression,
  InferredType,
  Reference,
  Statement,
} from "./types.ts";

export class Analyzer {
  private nodeDefinitions = new Map<string, DialogueNode>();
  private nodeReferences: Reference[] = [];
  private errors: AnalysisError[] = [];
  private warnings: AnalysisWarning[] = [];
  private suggestions: AnalysisSuggestion[] = [];

  private definedVariables = new Set<string>();
  private variableTypes = new Map<string, InferredType>();

  private usedVariables = new Set<string>();
  private variableDefinitions = new Map<
    string,
    { line: number; column: number }
  >();

  public analyzeNode(node: DialogueNode): void {
    this.checkEmptyNode(node);
    this.checkDuplicateNode(node);
    this.checkFunctionCalls(node);
    this.checkDeadEndNode(node);
    this.collectDefinedVariables(node);
    this.checkSuspiciousConditions(node);
    this.checkIdenticalChoices(node);

    if (!this.nodeDefinitions.has(node.id)) {
      this.nodeDefinitions.set(node.id, node);
    }
    this.collectReferences(node);
  }

  public finalizeAnalysis(): AnalysisResult {
    this.inferVariableTypes();
    this.checkNodeReferences();
    this.checkReachability();
    this.checkCircularReferences();
    this.checkEntryPoint();
    this.checkUndefinedVariables();
    this.checkTypeMismatches();
    this.checkUnusedVariables();

    return this.getResult();
  }

  private checkEmptyNode(node: DialogueNode): void {
    if (node.statements.length === 0) {
      this.errors.push({
        type: "empty_node",
        message: `Node '${node.id}' is empty and has no statements`,
        line: node.line,
        column: node.column,
        node: node.id,
        severity: "error",
      });
    }
  }

  private checkDeadEndNode(node: DialogueNode): void {
    // An empty node is a different error, so we'll skip this check for them.
    if (node.statements.length === 0) {
      return;
    }

    const hasNavigation = node.statements.some(
      (stmt) => stmt.type === "Choice" || stmt.type === "Goto",
    );

    if (!hasNavigation) {
      this.warnings.push({
        type: "dead_end",
        message: `Node '${node.id}' is a dead end; it has no choices or goto statements to continue the dialogue.`,
        line: node.line,
        column: node.column,
        node: node.id,
        severity: "warning",
      });
    }
  }

  private checkDuplicateNode(node: DialogueNode): void {
    if (this.nodeDefinitions.has(node.id)) {
      const originalNode = this.nodeDefinitions.get(node.id)!;
      this.errors.push({
        type: "duplicate_node",
        message: `Duplicate node definition for '${node.id}'. It was first defined on line ${originalNode.line}.`,
        line: node.line,
        column: node.column,
        node: node.id,
        severity: "error",
      });
    }
  }

  private checkFunctionCalls(node: DialogueNode): void {
    for (const statement of node.statements) {
      switch (statement.type) {
        case "Conditional":
          if (statement.condition) {
            this.traverseExpression(
              statement.condition,
              node.id,
              statement.line,
              statement.column,
            );
          }
          // Recursively check statements in if branch
          for (const stmt of statement.statements) {
            this.checkStatementExpressions(stmt, node.id);
          }
          // Check else branch if it exists
          if (statement.elseStatements) {
            for (const stmt of statement.elseStatements) {
              this.checkStatementExpressions(stmt, node.id);
            }
          }
          break;
        case "Assignment":
          this.traverseExpression(
            statement.value,
            node.id,
            statement.line,
            statement.column,
          );
          break;
        case "Say":
          if (statement.condition) {
            this.traverseExpression(
              statement.condition,
              node.id,
              statement.line,
              statement.column,
            );
          }
          for (const interp of statement.interpolations) {
            this.traverseExpression(
              interp.expression,
              node.id,
              statement.line,
              statement.column,
            );
          }
          break;
        case "Choice":
          if (statement.condition) {
            this.traverseExpression(
              statement.condition,
              node.id,
              statement.line,
              statement.column,
            );
          }
          break;
      }
    }
  }
  // Helper method to avoid code duplication
  private checkStatementExpressions(
    statement: Statement,
    nodeId: string,
  ): void {
    switch (statement.type) {
      case "Assignment":
        this.traverseExpression(
          statement.value,
          nodeId,
          statement.line,
          statement.column,
        );
        break;
      case "Say":
        if (statement.condition) {
          this.traverseExpression(
            statement.condition,
            nodeId,
            statement.line,
            statement.column,
          );
        }
        for (const interp of statement.interpolations) {
          this.traverseExpression(
            interp.expression,
            nodeId,
            statement.line,
            statement.column,
          );
        }
        break;
      case "Choice":
        if (statement.condition) {
          this.traverseExpression(
            statement.condition,
            nodeId,
            statement.line,
            statement.column,
          );
        }
        break;
      case "Conditional":
        // Recursive case
        this.traverseExpression(
          statement.condition,
          nodeId,
          statement.line,
          statement.column,
        );
        for (const stmt of statement.statements) {
          this.checkStatementExpressions(stmt, nodeId);
        }
        if (statement.elseStatements) {
          for (const stmt of statement.elseStatements) {
            this.checkStatementExpressions(stmt, nodeId);
          }
        }
        break;
    }
  }

  private collectReferences(node: DialogueNode): void {
    for (const statement of node.statements) {
      if (statement.type === "Choice") {
        this.nodeReferences.push({
          target: statement.target,
          line: statement.line,
          column: statement.column,
          type: "choice",
          sourceNode: node.id,
        });
      } else if (statement.type === "Goto") {
        this.nodeReferences.push({
          target: statement.target,
          line: statement.line,
          column: statement.column,
          type: "goto",
          sourceNode: node.id,
        });
      }
    }
  }

  private checkNodeReferences(): void {
    for (const ref of this.nodeReferences) {
      if (!this.nodeDefinitions.has(ref.target)) {
        this.errors.push({
          type: "missing_node",
          message: `Node '${ref.target}' does not exist (referenced from '${ref.sourceNode}')`,
          line: ref.line,
          column: ref.column,
          severity: "error",
        });
      }
    }
  }

  private checkReachability(): void {
    const allNodeIds = new Set(this.nodeDefinitions.keys());
    const startNode = this.nodeDefinitions.get("start");

    // If there's no 'start' node, we can't determine reachability.
    // A separate check, checkEntryPoint, will handle this error.
    if (!startNode) {
      return;
    }

    const reachableNodes = new Set<string>();
    const queue: string[] = ["start"];
    reachableNodes.add("start");

    while (queue.length > 0) {
      const currentNodeId = queue.shift()!;

      // Find all nodes referenced from the current node
      const referencesFromCurrent = this.nodeReferences.filter(
        (ref) => ref.sourceNode === currentNodeId,
      );

      for (const ref of referencesFromCurrent) {
        if (!reachableNodes.has(ref.target)) {
          reachableNodes.add(ref.target);
          queue.push(ref.target);
        }
      }
    }

    // Any node in allNodeIds that isn't in reachableNodes is unreachable.
    for (const nodeId of allNodeIds) {
      if (nodeId !== "start" && !reachableNodes.has(nodeId)) {
        const unreachableNode = this.nodeDefinitions.get(nodeId)!;
        this.warnings.push({
          type: "unreachable_node",
          message: `Node '${nodeId}' is unreachable from the 'start' node.`,
          line: unreachableNode.line,
          column: unreachableNode.column,
          node: nodeId,
          severity: "warning",
        });
      }
    }
  }

  private checkCircularReferences(): void {
    const gotoReferences = this.nodeReferences.filter(
      (ref) => ref.type === "goto",
    );
    const adj = new Map<string, string[]>();

    // Build an adjacency list for the goto graph
    for (const ref of gotoReferences) {
      if (!adj.has(ref.sourceNode)) {
        adj.set(ref.sourceNode, []);
      }
      adj.get(ref.sourceNode)!.push(ref.target);
    }

    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const reportedCycles = new Set<string>();

    const detectCycle = (nodeId: string, path: string[] = []) => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const neighbors = adj.get(nodeId) || [];

      for (const neighbor of neighbors) {
        if (recursionStack.has(neighbor)) {
          // Cycle detected
          const cyclePath = path.slice(path.indexOf(neighbor));
          for (const cycleNodeId of cyclePath) {
            if (!reportedCycles.has(cycleNodeId)) {
              const cycleNode = this.nodeDefinitions.get(cycleNodeId)!;
              this.warnings.push({
                type: "circular_reference",
                message: `Node '${cycleNodeId}' is part of an inescapable 'goto' loop: ${cyclePath.join(" -> ")} -> ${neighbor}`,
                line: cycleNode.line,
                column: cycleNode.column,
                node: cycleNodeId,
                severity: "warning",
              });
              reportedCycles.add(cycleNodeId);
            }
          }
        } else if (!visited.has(neighbor)) {
          detectCycle(neighbor, [...path]);
        }
      }
      recursionStack.delete(nodeId);
    };

    for (const nodeId of this.nodeDefinitions.keys()) {
      if (!visited.has(nodeId)) {
        detectCycle(nodeId);
      }
    }
  }

  private checkEntryPoint(): void {
    // We only check for an entry point if there are nodes to begin with.
    // An empty file shouldn't produce an error.
    if (this.nodeDefinitions.size > 0 && !this.nodeDefinitions.has("start")) {
      this.errors.push({
        type: "missing_entry_point",
        message:
          "The script is missing a 'start' node, which is required as the entry point.",
        // This is a file-level error, so we'll point to the beginning of the file.
        line: 1,
        column: 1,
        severity: "error",
      });
    }
  }

  private getResult(): AnalysisResult {
    return {
      valid: this.errors.length === 0,
      errors: [...this.errors],
      warnings: [...this.warnings],
      suggestions: [...this.suggestions],
    };
  }

  // A recursive helper to find all function calls in an expression tree
  private traverseExpression(
    expression: Expression,
    nodeId: string,
    line: number,
    column: number,
  ): void {
    switch (expression.type) {
      case "FunctionCall":
        // Check the function call itself
        switch (expression.name) {
          case "random":
            if (expression.args.length !== 2) {
              this.errors.push({
                type: "invalid_function_args",
                message: `Function 'random' expects exactly 2 arguments, but got ${expression.args.length}.`,
                line: expression.line ?? line,
                column: expression.column ?? column,
                node: nodeId,
                severity: "error",
              });
            }
            break;
          default:
            this.errors.push({
              type: "invalid_function",
              message: `Unknown function called: '${expression.name}'.`,
              line: expression.line ?? line,
              column: expression.column ?? column,
              node: nodeId,
              severity: "error",
            });
        }
        // Then, check the arguments of the function call
        for (const arg of expression.args) {
          this.traverseExpression(arg, nodeId, line, column);
        }
        break;

      case "BinaryOp":
        this.traverseExpression(expression.left, nodeId, line, column);
        this.traverseExpression(expression.right, nodeId, line, column);
        break;

      case "UnaryOp":
        this.traverseExpression(expression.operand, nodeId, line, column);
        break;

      // Literals and Variables are base cases, no recursion needed.
      case "Literal":
      case "Variable":
        break;
    }
  }

  private collectDefinedVariables(node: DialogueNode): void {
    for (const statement of node.statements) {
      if (statement.type === "Assignment") {
        this.definedVariables.add(statement.variable);
        // Store the location of the definition for better suggestions
        if (!this.variableDefinitions.has(statement.variable)) {
          this.variableDefinitions.set(statement.variable, {
            line: statement.line,
            column: statement.column,
          });
        }
      }
    }
  }

  private checkUndefinedVariablesInStatements(
    statements: Statement[],
    node: DialogueNode,
  ): void {
    for (const statement of statements) {
      const expressionsToCheck: Expression[] = [];
      if (statement.type === "Assignment") {
        expressionsToCheck.push(statement.value);
      } else if (statement.type === "Choice" && statement.condition) {
        expressionsToCheck.push(statement.condition);
      } else if (statement.type === "Say") {
        statement.interpolations.forEach((interp) =>
          expressionsToCheck.push(interp.expression),
        );
      } else if (statement.type === "Conditional") {
        if (statement.condition) {
          expressionsToCheck.push(statement.condition);
        }
        // Recursively check statements in if branch
        this.checkUndefinedVariablesInStatements(statement.statements, node);
        // Check else branch if it exists
        if (statement.elseStatements) {
          this.checkUndefinedVariablesInStatements(
            statement.elseStatements,
            node,
          );
        }
      }
      for (const expression of expressionsToCheck) {
        this.findUndefinedVariablesInExpression(
          expression,
          "", // nodeId is not needed here
          statement.line,
          statement.column,
        );
      }
    }
  }
  private checkUndefinedVariables(): void {
    for (const node of this.nodeDefinitions.values()) {
      this.checkUndefinedVariablesInStatements(node.statements, node);
    }
  }

  private findUndefinedVariablesInExpression(
    expression: Expression,
    nodeId: string,
    line: number,
    column: number,
  ): void {
    switch (expression.type) {
      case "Variable":
        if (!this.definedVariables.has(expression.name)) {
          this.warnings.push({
            type: "undefined_variable",
            message: `Variable '@${expression.name}' is used but never assigned a value.`,
            line: expression.line ?? line,
            column: expression.column ?? column,
            node: nodeId,
            severity: "warning",
          });
        }
        break;
      case "BinaryOp":
        this.findUndefinedVariablesInExpression(
          expression.left,
          nodeId,
          line,
          column,
        );
        this.findUndefinedVariablesInExpression(
          expression.right,
          nodeId,
          line,
          column,
        );
        break;
      case "UnaryOp":
        this.findUndefinedVariablesInExpression(
          expression.operand,
          nodeId,
          line,
          column,
        );
        break;
      case "FunctionCall":
        expression.args.forEach((arg) =>
          this.findUndefinedVariablesInExpression(arg, nodeId, line, column),
        );
        break;
      // Literals are base cases, no variables to check.
      case "Literal":
        break;
    }
  }

  private checkSuspiciousConditions(node: DialogueNode): void {
    for (const statement of node.statements) {
      if (statement.type === "Choice" && statement.condition) {
        const result = this.evaluateStaticExpression(statement.condition);
        if (result === false) {
          this.warnings.push({
            type: "suspicious_condition",
            message: `The condition for this choice is always false, making it unreachable.`,
            line: statement.condition.line ?? statement.line,
            column: statement.condition.column ?? statement.column,
            node: node.id,
            severity: "warning",
          });
        }
      }
    }
  }
  // A simple static evaluator for literal expressions.
  // Returns boolean if the result is certain, otherwise null.
  private evaluateStaticExpression(expression: Expression): boolean | null {
    if (expression.type === "Literal") {
      return !!expression.value; // Coerce to boolean
    }

    if (expression.type === "BinaryOp") {
      const left = this.evaluateStaticExpression(expression.left);
      const right = this.evaluateStaticExpression(expression.right);

      // We can only evaluate if both sides are statically known
      if (left === null || right === null) {
        return null;
      }

      switch (expression.operator) {
        case "==":
          return left == right;
        case "!=":
          return left != right;
        case ">":
          return left > right;
        case "<":
          return left < right;
        case ">=":
          return left >= right;
        case "<=":
          return left <= right;
        case "&&":
          return left && right;
        case "||":
          return left || right;
        default:
          return null; // Unsupported operator for static analysis
      }
    }
    if (expression.type === "UnaryOp" && expression.operator === "!") {
      const operand = this.evaluateStaticExpression(expression.operand);
      if (operand === null) return null;
      return !operand;
    }

    return null;
  }

  private inferVariableTypes(): void {
    for (const node of this.nodeDefinitions.values()) {
      for (const statement of node.statements) {
        if (statement.type === "Assignment") {
          const expressionType = this.getExpressionType(statement.value);
          this.variableTypes.set(statement.variable, expressionType);
        }
      }
    }
  }

  private checkTypeMismatches(): void {
    for (const node of this.nodeDefinitions.values()) {
      for (const statement of node.statements) {
        // We only need to check expressions where operations occur.
        // A simple assignment like `@x = 10` is for inference, not checking.
        if (
          statement.type === "Assignment" &&
          statement.value.type === "BinaryOp"
        ) {
          this.getExpressionType(statement.value, { node, statement });
        } else if (statement.type === "Choice" && statement.condition) {
          this.getExpressionType(statement.condition, { node, statement });
        } else if (statement.type === "Say") {
          statement.interpolations.forEach((interp) =>
            this.getExpressionType(interp.expression, { node, statement }),
          );
        }
      }
    }
  }

  private getExpressionType(
    expression: Expression,
    context?: { node: DialogueNode; statement: Statement },
  ): InferredType {
    switch (expression.type) {
      case "Literal":
        if (typeof expression.value === "number") return "number";
        if (typeof expression.value === "boolean") return "boolean";
        if (typeof expression.value === "string") return "string";
        return "any";

      case "Variable":
        return this.variableTypes.get(expression.name) || "any";

      case "FunctionCall":
        if (expression.name === "random") return "number";
        return "any";

      case "BinaryOp": {
        const leftType = this.getExpressionType(expression.left, context);
        const rightType = this.getExpressionType(expression.right, context);

        if (leftType === "any" || rightType === "any") return "any";

        const numericOps = ["+", "-", "*", "/"];
        const comparisonOps = [">", "<", ">=", "<="];
        const booleanOps = ["&&", "||"];

        let mismatch = false;
        if (numericOps.includes(expression.operator)) {
          if (leftType !== "number" || rightType !== "number") {
            mismatch = true;
          }
        } else if (comparisonOps.includes(expression.operator)) {
          // Add this check
          if (leftType !== "number" || rightType !== "number") {
            mismatch = true;
          }
        } else if (booleanOps.includes(expression.operator)) {
          if (leftType !== "boolean" || rightType !== "boolean") {
            mismatch = true;
          }
        }

        if (mismatch && context) {
          this.warnings.push({
            type: "type_mismatch",
            message: `Cannot apply operator '${expression.operator}' to types '${leftType}' and '${rightType}'.`,
            line: expression.line ?? context.statement.line,
            column: expression.column ?? context.statement.column,
            node: context.node.id,
            severity: "warning",
          });
          return "any";
        }

        if (numericOps.includes(expression.operator)) return "number";
        if (comparisonOps.includes(expression.operator)) return "boolean";
        if (booleanOps.includes(expression.operator)) return "boolean";
        if (["==", "!="].includes(expression.operator)) return "boolean";

        return "any";
      }
      case "UnaryOp":
        // You might want to add more logic here for UnaryOp in the future
        return this.getExpressionType(expression.operand, context);

      default:
        return "any";
    }
  }

  private collectUsedVariables(): void {
    for (const node of this.nodeDefinitions.values()) {
      for (const statement of node.statements) {
        const expressionsToCheck: Expression[] = [];
        if (statement.type === "Assignment") {
          expressionsToCheck.push(statement.value);
        } else if (statement.type === "Choice" && statement.condition) {
          expressionsToCheck.push(statement.condition);
        } else if (statement.type === "Say") {
          statement.interpolations.forEach((interp) =>
            expressionsToCheck.push(interp.expression),
          );
        }

        for (const expression of expressionsToCheck) {
          this.findUsedVariablesInExpression(expression);
        }
      }
    }
  }
  private findUsedVariablesInExpression(expression: Expression): void {
    switch (expression.type) {
      case "Variable":
        this.usedVariables.add(expression.name);
        break;
      case "BinaryOp":
        this.findUsedVariablesInExpression(expression.left);
        this.findUsedVariablesInExpression(expression.right);
        break;
      case "UnaryOp":
        this.findUsedVariablesInExpression(expression.operand);
        break;
      case "FunctionCall":
        expression.args.forEach((arg) =>
          this.findUsedVariablesInExpression(arg),
        );
        break;
      case "Literal":
        break;
    }
  }

  private checkUnusedVariables(): void {
    // First, collect all used variables from the entire script
    this.collectUsedVariables();

    // Then, check against the defined variables
    for (const variableName of this.definedVariables) {
      if (!this.usedVariables.has(variableName)) {
        const def = this.variableDefinitions.get(variableName)!;
        this.suggestions.push({
          type: "unused_variable",
          message: `Variable '@${variableName}' is assigned a value but is never used.`,
          line: def.line,
          column: def.column,
          severity: "info",
        });
      }
    }
  }

  private checkIdenticalChoices(node: DialogueNode): void {
    const seenChoices = new Set<string>();
    for (const statement of node.statements) {
      if (statement.type === "Choice") {
        if (seenChoices.has(statement.text)) {
          this.warnings.push({
            type: "identical_choice",
            message: `Node '${node.id}' has duplicate choices with the text: "${statement.text}"`,
            line: statement.textLine ?? statement.line,
            column: statement.textColumn ?? statement.column,
            node: node.id,
            severity: "warning",
          });
        }
        seenChoices.add(statement.text);
      }
    }
  }
}
