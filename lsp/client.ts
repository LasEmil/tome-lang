// client/lsp-client.ts
// LSP Client that connects Monaco to the Web Worker

import * as monaco from "monaco-editor";
import type {
  RequestMessage,
  ResponseMessage,
  NotificationMessage,
  InitializeParams,
  PublishDiagnosticsParams,
  MessageType,
} from "./types.ts";
import { LspLogger } from "./logger.ts";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};

export class LSPClient {
  private worker: Worker;
  private nextRequestId = 1;
  private pendingRequests = new Map<string | number, PendingRequest>();
  private modelUri: monaco.Uri | null = null;

  constructor(
    workerPath: string,
    public logger: LspLogger,
  ) {
    this.worker = new Worker(workerPath, { type: "module" });
    this.worker.addEventListener(
      "message",
      this.handleWorkerMessage.bind(this),
    );
    this.worker.addEventListener("error", this.handleWorkerError.bind(this));
    this.logger.log("LSP Client created, worker started at " + workerPath);
  }

  private handleWorkerMessage(event: MessageEvent): void {
    const message = event.data;

    // Response to a request
    if ("id" in message && message.id !== undefined) {
      const response = message as ResponseMessage;
      const pending = this.pendingRequests.get(response.id);

      if (pending) {
        this.pendingRequests.delete(response.id);

        if (response.error) {
          pending.reject(new Error(response.error.message));
        } else {
          pending.resolve(response.result);
        }
      }
    }
    // Notification from server
    else if ("method" in message) {
      const notification = message as NotificationMessage;
      this.handleNotification(notification);
    }
  }

  private handleNotification(notification: NotificationMessage): void {
    switch (notification.method) {
      case "textDocument/publishDiagnostics":
        this.handleDiagnostics(notification.params as PublishDiagnosticsParams);
        break;

      default:
        this.logger.warn(`Unhandled notification: ${notification.method}`);
    }
  }

  private handleDiagnostics(params: PublishDiagnosticsParams): void {
    this.logger.log("Received diagnostics", params);

    const markers: monaco.editor.IMarkerData[] = params.diagnostics.map(
      (diag) => {
        const marker: monaco.editor.IMarkerData = {
          severity: diag.severity,
          startLineNumber: diag.range.start.line,
          startColumn: diag.range.start.character,
          endLineNumber: diag.range.end.line,
          endColumn: diag.range.end.character,
          message: diag.message,
        };
        if (diag.code) {
          marker.code = diag.code?.toString();
        }
        if (diag.source) {
          marker.source = diag.source;
        }

        return marker;
      },
    );

    const model = monaco.editor.getModel(this.modelUri!);

    if (!model) {
      this.logger.error(`No model found for URI: ${params.uri}`);
      return;
    }
    monaco.editor.setModelMarkers(model, "tome-lsp", markers);
  }

  private handleWorkerError(error: ErrorEvent): void {
    this.logger.error(`Worker error: ${error.message}`, error);
  }

  private sendRequest(method: MessageType, params?: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = this.nextRequestId++;
      const request: RequestMessage = {
        id,
        method,
        params,
      };

      this.pendingRequests.set(id, { resolve, reject });
      this.worker.postMessage(request);

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error("Request timeout"));
        }
      }, 30000);
    });
  }

  private sendNotification(method: MessageType, params?: unknown): void {
    const notification: NotificationMessage = {
      method,
      params,
    };
    this.worker.postMessage(notification);
  }

  async initialize(): Promise<unknown> {
    const params: InitializeParams = {
      rootUri: null,
      capabilities: {},
    };

    const result = await this.sendRequest("initialize", params);
    this.sendNotification("initialized");

    this.logger.log("Initialized", result);
    return result;
  }

  didOpenTextDocument(
    uri: string,
    languageId: string,
    version: number,
    text: string,
  ): void {
    this.modelUri = monaco.Uri.parse(uri);
    this.logger.log("didOpenTextDocument", { uri, languageId, version });

    this.sendNotification("textDocument/didOpen", {
      textDocument: {
        uri,
        languageId,
        version,
        text,
      },
    });
  }

  didChangeTextDocument(uri: string, version: number, text: string): void {
    this.sendNotification("textDocument/didChange", {
      textDocument: {
        uri,
        version,
      },
      contentChanges: [
        {
          text, // Full document sync
        },
      ],
    });
  }

  async shutdown(): Promise<void> {
    await this.sendRequest("shutdown");
    this.worker.terminate();
    this.logger.log("Shutdown complete");
  }

  // Helper to connect to Monaco editor
  connectToMonaco(
    editor: monaco.editor.IStandaloneCodeEditor,
    uri: string,
    languageId: string,
  ): () => void {
    const model = editor.getModel();
    if (!model) {
      throw new Error("Editor has no model");
    }

    let version = 0;

    // Send initial content
    this.didOpenTextDocument(uri, languageId, version, model.getValue());

    // Listen for content changes
    const changeDisposable = model.onDidChangeContent(() => {
      version++;
      this.didChangeTextDocument(uri, version, model.getValue());
    });

    // Cleanup function
    return () => {
      changeDisposable.dispose();
    };
  }
}

// Example usage helper
export async function setupLSPForMonaco(
  editor: monaco.editor.IStandaloneCodeEditor,
  workerPath: string,
  uri: string = "file:///main.custom",
  languageId: string = "custom-lang",
): Promise<{ client: LSPClient; cleanup: () => void }> {
  const logger = new LspLogger("client", true);
  const client = new LSPClient(workerPath, logger);

  // Initialize the LSP
  await client.initialize();

  // Connect to Monaco
  const cleanup = client.connectToMonaco(editor, uri, languageId);

  return { client, cleanup };
}
