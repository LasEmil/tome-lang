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
  type MessageType,
} from "./types.ts";

import treeSitterWasm from "web-tree-sitter/tree-sitter.wasm?url";
import tomeWasm from "../tree-sitter-tome/tree-sitter-tome.wasm?url";
import Parser from "web-tree-sitter";
import { TreeSitterAdapter } from "../dsl/treeSitterAdapter.ts";
import { Analyzer } from "../dsl/analyzer.ts";
import { LspLogger } from "./logger.ts";

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

  constructor(public logger: LspLogger) {
    this.logger.log("Created");
  }

  async initialize(params: InitializeParams): Promise<InitializeResult> {
    this.logger.log("Initializing LSP Server", params);
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

    return {
      capabilities: {
        textDocumentSync: 1,
        completionProvider: false,
        hoverProvider: false,
      },
    };
  }

  handleDidOpen(params: DidOpenTextDocumentParams): void {
    const { textDocument } = params;
    this.logger.log("Did open document", textDocument.uri);

    this.documents.set(textDocument.uri, {
      uri: textDocument.uri,
      version: textDocument.version,
      content: textDocument.text,
      languageId: textDocument.languageId,
    });

    this.analyzeDocument(textDocument.uri);
  }

  handleDidChange(params: DidChangeTextDocumentParams): void {
    const { textDocument, contentChanges } = params;
    const doc = this.documents.get(textDocument.uri);

    if (!doc) {
      this.logger.log("Document not found on change", textDocument.uri);
      return;
    }

    // For full sync, just take the full text from first change
    // For incremental, you'd apply each change to the existing content
    if (contentChanges.length > 0) {
      const changes = contentChanges?.[0];
      if (changes) {
        doc.content = changes.text;
      }
      doc.version = textDocument.version;
    }

    this.logger.log("Handling didChange", textDocument.uri);

    // Re-analyze
    this.analyzeDocument(textDocument.uri);
  }

  private async analyzeDocument(uri: string): Promise<void> {
    const doc = this.documents.get(uri);
    if (!doc) return;

    this.logger.log("Analyzing document", uri);

    try {
      const diagnostics = await this.runAnalysis(doc.content);

      // Send diagnostics back to main thread
      this.publishDiagnostics({
        uri: doc.uri,
        version: doc.version,
        diagnostics,
      });
    } catch (error) {
      this.logger.error("Analysis error", error);
    }
  }

  private async runAnalysis(content: string): Promise<Diagnostic[]> {
    const tree = this.parser?.parse(content);
    const parseResult = this.adapter?.convert(tree!, content);
    if (parseResult?.value && parseResult?.valid) {
      const nodes = TreeSitterAdapter.getNodeNetwork(parseResult.value);
      this.sendNotification("nodeNetwork/update", { nodes });

      const edgeMap = TreeSitterAdapter.linkNodes(parseResult.value);
      this.logger.log("Edge map", edgeMap);
      this.sendNotification("nodeNetwork/updateEdges", edgeMap);
    }
    const analyzer = new Analyzer();
    if (parseResult?.value) {
      for (const node of parseResult.value.nodes) {
        analyzer.analyzeNode(node);
      }
    }
    this.logger.log("Parsing complete", parseResult);
    const analysisResult = analyzer.finalizeAnalysis();
    this.logger.log("Analysis complete", analysisResult);

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
          severity: item.severity,
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
    };

    if (error) {
      response.error = error;
    }
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
            this.logger.warn(`Unhandled notification: ${notification.method}`);
        }
      }
    } catch (error) {
      this.logger.error("Error handling message", error);
      if ("id" in message) {
        this.sendResponse((message as RequestMessage).id, null, {
          code: -32603,
          message: String(error),
        });
      }
    }
  }
}

const logger = new LspLogger("worker", true);
const server = new LSPServer(logger);

self.addEventListener("message", (event: MessageEvent) => {
  server.handleMessage(event.data);
});
