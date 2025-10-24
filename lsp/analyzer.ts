import type {
  AnalysisDiagnostic,
  AnalysisResult,
  InferredType,
} from "./../dsl/types.ts";
import { MarkerSeverity } from "./../dsl/types.ts";
import type Parser from "web-tree-sitter";

interface Reference {
  target: string;
  line: number;
  column: number;
  type: "choice" | "goto";
  sourceNode: string;
}

interface NodeInfo {
  id: string;
  line: number;
  column: number;
  node: Parser.SyntaxNode;
}

export class Analyzer {
  private tree: Parser.Tree;
  private sourceCode: string;

  private nodeDefinitions = new Map<string, NodeInfo>();
  private nodeReferences: Reference[] = [];
  private errors: AnalysisDiagnostic[] = [];
  private warnings: AnalysisDiagnostic[] = [];
  private suggestions: AnalysisDiagnostic[] = [];

  private definedVariables = new Set<string>();
  private variableTypes = new Map<string, InferredType>();
  private usedVariables = new Set<string>();
  private variableDefinitions = new Map<
    string,
    { line: number; column: number }
  >();

  constructor(tree: Parser.Tree, sourceCode: string) {
    this.tree = tree;
    this.sourceCode = sourceCode;
  }

  public analyze(): AnalysisResult {
    // First pass: collect all node definitions
    this.collectNodeDefinitions();

    // Second pass: analyze each node
    for (const [nodeId, nodeInfo] of this.nodeDefinitions) {
      this.analyzeNode(nodeInfo);
    }

    // Final checks
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

  private collectNodeDefinitions(): void {
    const rootNode = this.tree.rootNode;

    // The root should be a source_file with node_definition children
    // Iterate through direct children to find all node_definitions
    for (let i = 0; i < rootNode.namedChildCount; i++) {
      const child = rootNode.namedChild(i);
      if (child && child.type === "node_definition") {
        const nameNode = child.childForFieldName("name");
        if (nameNode) {
          const nodeId = this.getNodeText(nameNode);
          const line = nameNode.startPosition.row + 1;
          const column = nameNode.startPosition.column + 1;

          if (this.nodeDefinitions.has(nodeId)) {
            const originalNode = this.nodeDefinitions.get(nodeId)!;
            this.errors.push({
              type: "duplicate_node",
              message: `Duplicate node definition for '${nodeId}'. It was first defined on line ${originalNode.line}.`,
              line,
              column,
              endColumn: column + nodeId.length,
              node: nodeId,
              severity: MarkerSeverity.Error,
            });
          } else {
            this.nodeDefinitions.set(nodeId, {
              id: nodeId,
              line,
              column,
              node: child,
            });
          }
        }
      } else if (child && child.type === "ERROR") {
        // Try to extract node definition from ERROR nodes
        // This handles cases where the parser failed but we can still identify the node
        this.tryExtractNodeFromError(child);
      }
    }
  }

  private tryExtractNodeFromError(errorNode: Parser.SyntaxNode): void {
    // Look for an identifier that might be a node name
    // Pattern: ERROR node might contain (identifier) as first child after "node" keyword
    const text = this.getNodeText(errorNode);

    // Check if this looks like a node definition
    if (text.trim().startsWith("node ")) {
      // Try to find the identifier child
      for (let i = 0; i < errorNode.namedChildCount; i++) {
        const child = errorNode.namedChild(i);
        if (child && child.type === "identifier") {
          const nodeId = this.getNodeText(child);
          const line = child.startPosition.row + 1;
          const column = child.startPosition.column + 1;

          if (!this.nodeDefinitions.has(nodeId)) {
            // Create a partial node definition from the ERROR node
            this.nodeDefinitions.set(nodeId, {
              id: nodeId,
              line,
              column,
              node: errorNode,
            });
          }
          break; // Only take the first identifier
        }
      }
    }
  }

  private analyzeNode(nodeInfo: NodeInfo): void {
    const { id: nodeId, line, column, node } = nodeInfo;

    // Check if node is empty
    const bodyStatements = this.getBodyStatements(node);
    if (bodyStatements.length === 0) {
      this.errors.push({
        type: "empty_node",
        message: `Node '${nodeId}' is empty and has no statements`,
        line,
        column,
        endColumn: column + nodeId.length,
        node: nodeId,
        severity: MarkerSeverity.Error,
      });
      return;
    }

    // Check for dead end
    this.checkDeadEndNode(nodeId, bodyStatements, line, column);

    // Collect variables and references
    this.collectDefinedVariables(nodeId, bodyStatements);
    this.collectReferences(nodeId, bodyStatements);

    // Check function calls and conditions
    this.checkFunctionCalls(nodeId, bodyStatements);
    this.checkSuspiciousConditions(nodeId, bodyStatements);
    this.checkIdenticalChoices(nodeId, bodyStatements);
  }

  private getBodyStatements(
    nodeDefNode: Parser.SyntaxNode,
  ): Parser.SyntaxNode[] {
    const statements: Parser.SyntaxNode[] = [];

    for (let i = 0; i < nodeDefNode.namedChildCount; i++) {
      const child = nodeDefNode.namedChild(i);
      if (child && child.type !== "identifier") {
        // Skip the name identifier
        statements.push(child);
      }
    }

    return statements;
  }

  private checkDeadEndNode(
    nodeId: string,
    statements: Parser.SyntaxNode[],
    line: number,
    column: number,
  ): void {
    const hasNavigation = statements.some(
      (stmt) =>
        stmt.type === "choice_statement" || stmt.type === "goto_statement",
    );

    if (!hasNavigation) {
      this.warnings.push({
        type: "dead_end",
        message: `Node '${nodeId}' is a dead end; it has no choices or goto statements to continue the dialogue.`,
        line,
        column,
        node: nodeId,
        severity: MarkerSeverity.Warning,
        endColumn: column + nodeId.length,
      });
    }
  }

  private collectDefinedVariables(
    nodeId: string,
    statements: Parser.SyntaxNode[],
  ): void {
    for (const stmt of statements) {
      if (stmt.type === "assignment_statement") {
        const varNode = stmt.childForFieldName("left") || stmt.child(0);
        if (varNode?.type === "variable") {
          const idNode = varNode.namedChild(0);
          if (idNode) {
            const varName = this.getNodeText(idNode);
            this.definedVariables.add(varName);

            if (!this.variableDefinitions.has(varName)) {
              this.variableDefinitions.set(varName, {
                line: idNode.startPosition.row + 1,
                column: idNode.startPosition.column + 1,
              });
            }
          }
        }
      }
    }
  }

  private collectReferences(
    nodeId: string,
    statements: Parser.SyntaxNode[],
  ): void {
    for (const stmt of statements) {
      if (stmt.type === "choice_statement" || stmt.type === "goto_statement") {
        const nodeRefNode = this.findNodeInChildren(stmt, "node_reference");
        if (nodeRefNode) {
          // Debug: check all children of node_reference
          // console.log(`node_reference children for ${stmt.type}:`);
          // for (let i = 0; i < nodeRefNode.childCount; i++) {
          //   const child = nodeRefNode.child(i);
          //   console.log(`  ${i}: ${child?.type} = "${this.getNodeText(child!)}"`);
          // }

          const targetNode = nodeRefNode.childForFieldName("target");
          if (targetNode) {
            const targetText = this.getNodeText(targetNode);
            // console.log(`Target node text: "${targetText}"`);
            const target = targetText.replace(/^:/, ""); // Remove colon if present

            this.nodeReferences.push({
              target,
              line: targetNode.startPosition.row + 1,
              column: targetNode.startPosition.column + 1,
              type: stmt.type === "choice_statement" ? "choice" : "goto",
              sourceNode: nodeId,
            });
          } else {
            // If there's no field named "target", look for the identifier child
            for (let i = 0; i < nodeRefNode.namedChildCount; i++) {
              const child = nodeRefNode.namedChild(i);
              if (child?.type === "identifier") {
                const target = this.getNodeText(child);
                this.nodeReferences.push({
                  target,
                  line: child.startPosition.row + 1,
                  column: child.startPosition.column + 1,
                  type: stmt.type === "choice_statement" ? "choice" : "goto",
                  sourceNode: nodeId,
                });
                break;
              }
            }
          }
        }
      }
    }
  }

  private checkFunctionCalls(
    nodeId: string,
    statements: Parser.SyntaxNode[],
  ): void {
    for (const stmt of statements) {
      this.traverseNodeForFunctionCalls(stmt, nodeId);
    }
  }

  private traverseNodeForFunctionCalls(
    node: Parser.SyntaxNode,
    nodeId: string,
  ): void {
    // Special handling for string_literal nodes that might contain interpolations
    if (node.type === "string_literal") {
      const text = this.getNodeText(node);
      // Check if this string has interpolations like #{...}
      const interpolationRegex = /#\{([^}]+)\}/g;
      let match;

      while ((match = interpolationRegex.exec(text)) !== null) {
        const interpolationContent = match[1];
        const interpolationStart = match.index;

        if (!interpolationContent) continue;
        // Try to parse the interpolation content as an expression
        // We need to analyze it for function calls
        this.analyzeInterpolationContent(
          interpolationContent,
          nodeId,
          node.startPosition.row + 1,
          node.startPosition.column + 1 + interpolationStart + 2, // +2 for #{
        );
      }
    }

    if (node.type === "function_call") {
      const nameNode = node.childForFieldName("name");
      if (nameNode) {
        const funcName = this.getNodeText(nameNode);
        const line = nameNode.startPosition.row + 1;
        const column = nameNode.startPosition.column + 1;

        if (funcName === "random") {
          // Count expression arguments (skip the name field)
          const args: Parser.SyntaxNode[] = [];
          for (let i = 0; i < node.namedChildCount; i++) {
            const child = node.namedChild(i);
            if (child && child.type === "expression") {
              args.push(child);
            }
          }

          if (args.length !== 2) {
            this.errors.push({
              type: "invalid_function_args",
              message: `Function 'random' expects exactly 2 arguments, but got ${args.length}.`,
              line,
              column,
              endColumn: column + funcName.length,
              node: nodeId,
              severity: MarkerSeverity.Error,
            });
          }
        } else {
          this.errors.push({
            type: "invalid_function",
            message: `Unknown function called: '${funcName}'.`,
            line,
            column,
            node: nodeId,
            severity: MarkerSeverity.Error,
            endColumn: column + funcName.length,
          });
        }
      }
    }

    // Recursively traverse ALL children (both named and unnamed)
    // This ensures we don't miss interpolations or other nested structures
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        this.traverseNodeForFunctionCalls(child, nodeId);
      }
    }
  }

  private analyzeInterpolationContent(
    content: string,
    nodeId: string,
    line: number,
    column: number,
  ): void {
    // Check for variables @variable_name
    const variableRegex = /@(\w+)/g;
    let match;

    while ((match = variableRegex.exec(content)) !== null) {
      const varName = match[1];
      const varColumn = column + match.index;
      if (!varName) continue;
      if (!this.definedVariables.has(varName)) {
        this.warnings.push({
          type: "undefined_variable",
          message: `Variable '@${varName}' is used but never assigned a value.`,
          line,
          column: varColumn,
          node: nodeId,
          severity: MarkerSeverity.Warning,
          endColumn: varColumn + varName.length + 1, // +1 for @
        });
      } else {
        this.usedVariables.add(varName);
      }
    }

    // Check for function calls like: functionName(args...)
    const functionCallRegex = /(\w+)\s*\(([^)]*)\)/g;

    while ((match = functionCallRegex.exec(content)) !== null) {
      const funcName = match[1];
      const argsString = match[2];
      const funcColumn = column + match.index;

      // Count arguments by splitting on commas (simple approach)
      const args = argsString?.trim()
        ? argsString.split(",").map((s) => s.trim())
        : [];

      if (funcName === "random") {
        if (args.length !== 2) {
          this.errors.push({
            type: "invalid_function_args",
            message: `Function 'random' expects exactly 2 arguments, but got ${args.length}.`,
            line,
            column: funcColumn,
            endColumn: funcColumn + funcName.length,
            node: nodeId,
            severity: MarkerSeverity.Error,
          });
        }
      } else {
        this.errors.push({
          type: "invalid_function",
          message: `Unknown function called: '${funcName}'.`,
          line,
          column: funcColumn,
          node: nodeId,
          severity: MarkerSeverity.Error,
          endColumn: funcColumn + (funcName?.length ?? 0),
        });
      }
    }
  }

  private checkSuspiciousConditions(
    nodeId: string,
    statements: Parser.SyntaxNode[],
  ): void {
    for (const stmt of statements) {
      if (stmt.type === "choice_statement") {
        const conditionClause = this.findNodeInChildren(
          stmt,
          "condition_clause",
        );
        if (conditionClause) {
          const conditionExpr = conditionClause.childForFieldName("condition");
          if (conditionExpr) {
            const result = this.evaluateStaticExpression(conditionExpr);
            if (result === false) {
              this.warnings.push({
                type: "suspicious_condition",
                message: `The condition for this choice is always false, making it unreachable.`,
                line: conditionExpr.startPosition.row + 1,
                column: conditionExpr.startPosition.column + 1,
                node: nodeId,
                severity: MarkerSeverity.Warning,
                endColumn: conditionExpr.endPosition.column + 1,
              });
            }
          }
        }
      }
    }
  }

  private evaluateStaticExpression(node: Parser.SyntaxNode): boolean | null {
    // Handle primary expressions
    if (node.type === "primary_expression") {
      return this.evaluateStaticExpression(node.namedChild(0)!);
    }

    // Handle literals
    if (node.type === "literal") {
      const literalChild = node.namedChild(0);
      if (literalChild) {
        const text = this.getNodeText(literalChild);
        if (literalChild.type === "boolean_literal") {
          return text === "true";
        }
        if (literalChild.type === "number_literal") {
          return parseFloat(text) !== 0;
        }
      }
    }

    // Handle expressions with operators
    if (node.type === "expression") {
      const left = node.childForFieldName("left");
      const right = node.childForFieldName("right");
      const operand = node.childForFieldName("operand");

      if (operand) {
        // Unary operator
        const op = this.findOperator(node);
        if (op === "!") {
          const operandValue = this.evaluateStaticExpression(operand);
          return operandValue === null ? null : !operandValue;
        }
      }

      if (left && right) {
        // Binary operator
        const leftVal = this.evaluateStaticExpression(left);
        const rightVal = this.evaluateStaticExpression(right);

        if (leftVal === null || rightVal === null) return null;

        const op = this.findOperator(node);
        switch (op) {
          case "==":
            return leftVal == rightVal;
          case "!=":
            return leftVal != rightVal;
          case "&&":
            return leftVal && rightVal;
          case "||":
            return leftVal || rightVal;
        }
      }
    }

    return null;
  }

  private checkIdenticalChoices(
    nodeId: string,
    statements: Parser.SyntaxNode[],
  ): void {
    const seenChoices = new Set<string>();

    for (const stmt of statements) {
      if (stmt.type === "choice_statement") {
        const textNode = stmt.childForFieldName("text");
        if (textNode) {
          const text = this.getNodeText(textNode).replace(/^"|"$/g, "");

          if (seenChoices.has(text)) {
            this.warnings.push({
              type: "identical_choice",
              message: `Node '${nodeId}' has duplicate choices with the text: "${text}"`,
              line: textNode.startPosition.row + 1,
              column: textNode.startPosition.column + 1,
              node: nodeId,
              severity: MarkerSeverity.Warning,
              endColumn: textNode.endPosition.column + 1,
            });
          }
          seenChoices.add(text);
        }
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
          severity: MarkerSeverity.Error,
          endColumn: ref.column + ref.target.length,
        });
      }
    }
  }

  private checkReachability(): void {
    const startNode = this.nodeDefinitions.get("start");
    if (!startNode) return;

    const reachableNodes = new Set<string>(["start"]);
    const queue: string[] = ["start"];

    while (queue.length > 0) {
      const currentNodeId = queue.shift()!;
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

    for (const [nodeId, nodeInfo] of this.nodeDefinitions) {
      if (nodeId !== "start" && !reachableNodes.has(nodeId)) {
        this.warnings.push({
          type: "unreachable_node",
          message: `Node '${nodeId}' is unreachable from the 'start' node.`,
          line: nodeInfo.line,
          column: nodeInfo.column,
          node: nodeId,
          severity: MarkerSeverity.Warning,
          endColumn: nodeInfo.column + nodeId.length,
        });
      }
    }
  }

  private checkCircularReferences(): void {
    const gotoReferences = this.nodeReferences.filter(
      (ref) => ref.type === "goto",
    );
    const adj = new Map<string, string[]>();

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
                severity: MarkerSeverity.Warning,
                endColumn: cycleNode.column + cycleNodeId.length,
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
    if (this.nodeDefinitions.size > 0 && !this.nodeDefinitions.has("start")) {
      this.errors.push({
        type: "missing_entry_point",
        message:
          "The script is missing a 'start' node, which is required as the entry point.",
        line: 1,
        column: 1,
        severity: MarkerSeverity.Error,
        endColumn: 1,
      });
    }
  }

  private inferVariableTypes(): void {
    for (const [nodeId, nodeInfo] of this.nodeDefinitions) {
      const statements = this.getBodyStatements(nodeInfo.node);
      for (const stmt of statements) {
        if (stmt.type === "assignment_statement") {
          const varNode = stmt.childForFieldName("left") || stmt.child(0);
          const valueNode = stmt.childForFieldName("right") || stmt.child(2);

          if (varNode?.type === "variable" && valueNode) {
            const idNode = varNode.namedChild(0);
            if (idNode) {
              const varName = this.getNodeText(idNode);
              const exprType = this.getExpressionType(valueNode);
              this.variableTypes.set(varName, exprType);
            }
          }
        }
      }
    }
  }

  private getExpressionType(node: Parser.SyntaxNode): InferredType {
    if (node.type === "primary_expression") {
      const child = node.namedChild(0);
      if (child) return this.getExpressionType(child);
    }

    if (node.type === "literal") {
      const literalChild = node.namedChild(0);
      if (literalChild) {
        if (literalChild.type === "number_literal") return "number";
        if (literalChild.type === "boolean_literal") return "boolean";
        if (literalChild.type === "string_literal") return "string";
      }
    }

    if (node.type === "variable") {
      const idNode = node.namedChild(0);
      if (idNode) {
        const varName = this.getNodeText(idNode);
        return this.variableTypes.get(varName) || "any";
      }
    }

    if (node.type === "function_call") {
      const nameNode = node.childForFieldName("name");
      if (nameNode && this.getNodeText(nameNode) === "random") {
        return "number";
      }
    }

    if (node.type === "expression") {
      const left = node.childForFieldName("left");
      const right = node.childForFieldName("right");
      const operand = node.childForFieldName("operand");

      // Handle unary operators
      if (operand) {
        const op = this.findOperator(node);
        if (op === "!") return "boolean";
        if (op === "-") return "number";
        return this.getExpressionType(operand);
      }

      // Handle binary operators
      if (left && right) {
        const op = this.findOperator(node);
        const numericOps = ["+", "-", "*", "/"];
        const comparisonOps = [">", "<", ">=", "<=", "==", "!="];
        const booleanOps = ["&&", "||"];

        if (numericOps.includes(op)) return "number";
        if (comparisonOps.includes(op) || booleanOps.includes(op))
          return "boolean";
      }

      // Single child expression - unwrap
      if (node.namedChildCount === 1) {
        return this.getExpressionType(node.namedChild(0)!);
      }
    }

    return "any";
  }

  private checkUndefinedVariables(): void {
    for (const [nodeId, nodeInfo] of this.nodeDefinitions) {
      const statements = this.getBodyStatements(nodeInfo.node);
      for (const stmt of statements) {
        this.findUndefinedVariablesInNode(stmt, nodeId);
      }
    }
  }

  private findUndefinedVariablesInNode(
    node: Parser.SyntaxNode,
    nodeId: string,
  ): void {
    if (node.type === "variable") {
      const idNode = node.namedChild(0);
      if (idNode) {
        const varName = this.getNodeText(idNode);

        // Mark as used regardless
        this.usedVariables.add(varName);

        // Check if defined
        if (!this.definedVariables.has(varName)) {
          this.warnings.push({
            type: "undefined_variable",
            message: `Variable '@${varName}' is used but never assigned a value.`,
            line: idNode.startPosition.row + 1,
            column: idNode.startPosition.column,
            node: nodeId,
            severity: MarkerSeverity.Warning,
            endColumn: idNode.endPosition.column + 1,
          });
        }
      }
    }

    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) this.findUndefinedVariablesInNode(child, nodeId);
    }
  }

  private checkTypeMismatches(): void {
    for (const [nodeId, nodeInfo] of this.nodeDefinitions) {
      const statements = this.getBodyStatements(nodeInfo.node);
      for (const stmt of statements) {
        this.checkTypesInNode(stmt, nodeId);
      }
    }
  }

  private checkTypesInNode(node: Parser.SyntaxNode, nodeId: string): void {
    if (node.type === "expression") {
      const left = node.childForFieldName("left");
      const right = node.childForFieldName("right");

      if (left && right) {
        const leftType = this.getExpressionType(left);
        const rightType = this.getExpressionType(right);
        const op = this.findOperator(node);

        if (
          leftType !== "any" &&
          rightType !== "any" &&
          leftType !== rightType
        ) {
          const numericOps = ["+", "-", "*", "/"];
          const comparisonOps = [">", "<", ">=", "<="];
          const booleanOps = ["&&", "||"];

          let mismatch = false;
          let expectedType = "";

          if (numericOps.includes(op) || comparisonOps.includes(op)) {
            if (leftType !== "number" || rightType !== "number") {
              mismatch = true;
              expectedType = "number";
            }
          } else if (booleanOps.includes(op)) {
            if (leftType !== "boolean" || rightType !== "boolean") {
              mismatch = true;
              expectedType = "boolean";
            }
          }

          if (mismatch) {
            this.warnings.push({
              type: "type_mismatch",
              message: `Cannot apply operator '${op}' to types '${leftType}' and '${rightType}'.`,
              line: node.startPosition.row + 1,
              column: node.startPosition.column + 1,
              node: nodeId,
              severity: MarkerSeverity.Warning,
              endColumn: node.endPosition.column + 1,
            });
          }
        }

        // Recursively check nested expressions
        this.checkTypesInNode(left, nodeId);
        this.checkTypesInNode(right, nodeId);
      }
    }

    // Traverse all children
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child !== node) {
        // Avoid infinite recursion
        this.checkTypesInNode(child, nodeId);
      }
    }
  }

  private checkUnusedVariables(): void {
    for (const variableName of this.definedVariables) {
      if (!this.usedVariables.has(variableName)) {
        const def = this.variableDefinitions.get(variableName)!;
        this.suggestions.push({
          type: "unused_variable",
          message: `Variable '@${variableName}' is assigned a value but is never used.`,
          line: def.line,
          column: def.column,
          severity: MarkerSeverity.Info,
          endColumn: def.column + variableName.length,
        });
      }
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

  // Helper methods
  private getNodeText(node: Parser.SyntaxNode): string {
    return this.sourceCode.substring(node.startIndex, node.endIndex);
  }

  private findNodeInChildren(
    node: Parser.SyntaxNode,
    type: string,
  ): Parser.SyntaxNode | null {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child?.type === type) return child;
    }
    return null;
  }

  private findOperator(node: Parser.SyntaxNode): string {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && !child.isNamed) {
        const text = this.getNodeText(child);
        if (
          [
            "+",
            "-",
            "*",
            "/",
            "==",
            "!=",
            ">",
            "<",
            ">=",
            "<=",
            "&&",
            "||",
            "!",
          ].includes(text)
        ) {
          return text;
        }
      }
    }
    return "";
  }

  private getExpressionChildren(node: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const children: Parser.SyntaxNode[] = [];
    for (let i = 0; i < node.namedChildCount; i++) {
      const child = node.namedChild(i);
      if (child) children.push(child);
    }
    return children;
  }
}
