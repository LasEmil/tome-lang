// workers/lsp-worker.ts
// LSP Server running in Web Worker

import {
  type RequestMessage,
  type ResponseMessage,
  type NotificationMessage,
  type InitializeParams,
  type InitializeResult,
  type DidOpenTextDocumentParams,
  type DidChangeTextDocumentParams,
  type PublishDiagnosticsParams,
  type Diagnostic,
  DiagnosticSeverity,
  type MessageType,
} from "./types.ts";

import treeSitterWasm from "web-tree-sitter/tree-sitter.wasm?url";
import tomeWasm from "../tree-sitter-tome/tree-sitter-tome.wasm?url";
import Parser from "web-tree-sitter";
import { TreeSitterAdapter } from "../dsl/treeSitterAdapter.ts";
import { Analyzer } from "../dsl/analyzer.ts";
// Document storage
interface DocumentState {
  uri: string;
  version: number;
  content: string;
  languageId: string;
}

class LSPServer {
  private documents = new Map<string, DocumentState>();
  private parser: Parser | null = null;
  private adapter: TreeSitterAdapter | null = null;
  private initialized = false;

  constructor() {
    console.log("[LSP Worker] Server created");
  }

  async initialize(params: InitializeParams): Promise<InitializeResult> {
    console.log("[LSP Worker] Initializing...", params);
    await Parser.init({
      locateFile() {
        return treeSitterWasm;
      },
    });
    this.parser = new Parser();
    const Lang = await Parser.Language.load(tomeWasm);
    this.parser.setLanguage(Lang);
    this.adapter = new TreeSitterAdapter();

    this.initialized = true;

    // TODO: Initialize your tree-sitter parser here
    // await initTreeSitter();

    return {
      capabilities: {
        textDocumentSync: 1, // Full sync for now, can optimize to incremental later
        completionProvider: false, // Enable when you implement
        hoverProvider: false,
      },
    };
  }

  handleDidOpen(params: DidOpenTextDocumentParams): void {
    const { textDocument } = params;
    console.log("[LSP Worker] Document opened:", textDocument.uri);

    this.documents.set(textDocument.uri, {
      uri: textDocument.uri,
      version: textDocument.version,
      content: textDocument.text,
      languageId: textDocument.languageId,
    });

    // Analyze immediately
    this.analyzeDocument(textDocument.uri);
  }

  handleDidChange(params: DidChangeTextDocumentParams): void {
    const { textDocument, contentChanges } = params;
    const doc = this.documents.get(textDocument.uri);

    if (!doc) {
      console.error("[LSP Worker] Document not found:", textDocument.uri);
      return;
    }

    // For full sync, just take the full text from first change
    // For incremental, you'd apply each change to the existing content
    if (contentChanges.length > 0) {
      doc.content = contentChanges[0].text;
      doc.version = textDocument.version;
    }

    console.log("[LSP Worker] Document changed:", textDocument.uri);

    // Re-analyze
    this.analyzeDocument(textDocument.uri);
  }

  private async analyzeDocument(uri: string): Promise<void> {
    const doc = this.documents.get(uri);
    if (!doc) return;

    console.log("[LSP Worker] Analyzing:", uri);

    try {
      // TODO: Replace with your actual tree-sitter parsing and analysis
      const diagnostics = await this.runAnalysis(doc.content);

      // Send diagnostics back to main thread
      this.publishDiagnostics({
        uri: doc.uri,
        version: doc.version,
        diagnostics,
      });
    } catch (error) {
      console.error("[LSP Worker] Analysis error:", error);
    }
  }

  private mapSeverity(
    level: "error" | "warning" | "info" | "hint",
  ): DiagnosticSeverity {
    switch (level) {
      case "error":
        return DiagnosticSeverity.Error;
      case "warning":
        return DiagnosticSeverity.Warning;
      case "info":
        return DiagnosticSeverity.Information;
      case "hint":
        return DiagnosticSeverity.Hint;
      default:
        return DiagnosticSeverity.Information;
    }
  }
  private async runAnalysis(content: string): Promise<Diagnostic[]> {
    const tree = this.parser?.parse(content);
    const parseResult = this.adapter?.convert(tree!, content);
    const analyzer = new Analyzer();
    if (parseResult?.value) {
      for (const node of parseResult.value.nodes) {
        analyzer.analyzeNode(node);
      }
    }
    const analysisResult = analyzer.finalizeAnalysis();
    console.log("[LSP Worker] parseResult", parseResult);
    console.log("[LSP Worker] analysisResult", analysisResult);

    const diagnostics: Diagnostic[] = [];
    Object.keys(analysisResult).forEach((key) => {
      if (key === "valid") return;
      const currentArray = analysisResult[key as keyof typeof analysisResult];
      if (!Array.isArray(currentArray)) return;
      for (const item of currentArray) {
        diagnostics.push({
          range: {
            start: { line: item.line, character: item.column },
            end: { line: item.line, character: item.endColumn },
          },
          severity: this.mapSeverity(item.severity),
          message: item.message,
          source: "tome-lsp",
        });
      }
    });

    return diagnostics;
  }

  private publishDiagnostics(params: PublishDiagnosticsParams): void {
    this.sendNotification("textDocument/publishDiagnostics", params);
  }

  private sendNotification(method: string, params: unknown): void {
    const notification: NotificationMessage = {
      method: method as MessageType,
      params,
    };
    self.postMessage(notification);
  }

  private sendResponse(
    id: string | number,
    result?: unknown,
    error?: { code: number; message: string },
  ): void {
    const response: ResponseMessage = {
      id,
      result,
      error,
    };
    self.postMessage(response);
  }

  async handleMessage(
    message: RequestMessage | NotificationMessage,
  ): Promise<void> {
    try {
      // Request messages have an id
      if ("id" in message) {
        const request = message as RequestMessage;
        let result: unknown;

        switch (request.method) {
          case "initialize":
            result = await this.initialize(request.params as InitializeParams);
            this.sendResponse(request.id, result);
            break;

          case "shutdown":
            this.initialized = false;
            this.documents.clear();
            this.sendResponse(request.id, null);
            break;

          default:
            this.sendResponse(request.id, null, {
              code: -32601,
              message: `Method not found: ${request.method}`,
            });
        }
      } else {
        // Notification messages (no response expected)
        const notification = message as NotificationMessage;

        switch (notification.method) {
          case "initialized":
            console.log("[LSP Worker] Client confirmed initialization");
            break;

          case "textDocument/didOpen":
            this.handleDidOpen(
              notification.params as DidOpenTextDocumentParams,
            );
            break;

          case "textDocument/didChange":
            this.handleDidChange(
              notification.params as DidChangeTextDocumentParams,
            );
            break;

          default:
            console.warn(
              "[LSP Worker] Unknown notification:",
              notification.method,
            );
        }
      }
    } catch (error) {
      console.error("[LSP Worker] Error handling message:", error);
      if ("id" in message) {
        this.sendResponse((message as RequestMessage).id, null, {
          code: -32603,
          message: String(error),
        });
      }
    }
  }
}

// Worker entry point
const server = new LSPServer();

self.addEventListener("message", (event: MessageEvent) => {
  server.handleMessage(event.data);
});
