// client/lsp-client.ts
// LSP Client that connects Monaco to the Web Worker

import * as monaco from "monaco-editor";
import type {
  RequestMessage,
  ResponseMessage,
  NotificationMessage,
  InitializeParams,
  // InitializeResult,
  PublishDiagnosticsParams,
  MessageType,
} from "./types.ts";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};

export class LSPClient {
  private worker: Worker;
  private nextRequestId = 1;
  private pendingRequests = new Map<string | number, PendingRequest>();
  private diagnosticsCollection: monaco.editor.IMarkerData[] = [];
  private modelUri: monaco.Uri | null = null;

  constructor(workerPath: string) {
    this.worker = new Worker(workerPath, { type: "module" });
    this.worker.addEventListener(
      "message",
      this.handleWorkerMessage.bind(this),
    );
    this.worker.addEventListener("error", this.handleWorkerError.bind(this));

    console.log("[LSP Client] Created");
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
        console.log("[LSP Client] Received notification:", notification.method);
    }
  }

  private handleDiagnostics(params: PublishDiagnosticsParams): void {
    console.log("[LSP Client] Received diagnostics:", params);

    // Convert LSP diagnostics to Monaco markers
    const markers: monaco.editor.IMarkerData[] = params.diagnostics.map(
      (diag) => {
        const marker: monaco.editor.IMarkerData = {
          severity: this.convertSeverity(diag.severity),
          startLineNumber: diag.range.start.line, // LSP is 0-based, Monaco is 1-based
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

    console.log("MODEL URI", this.modelUri);
    const model = monaco.editor.getModel(this.modelUri!);

    if (!model) {
      console.warn("[LSP Client] No model found for URI:", params.uri);
      return;
    }
    const allModels = monaco.editor.getModels();
    console.log(
      "[LSP Client] All models:",
      allModels.map((m) => m.uri.toString()),
    );
    // Set markers on the model
    console.log("[LSP Client] Setting markers on model:", model.uri.toString());
    console.log("[LSP Client] Markers:", markers);
    monaco.editor.setModelMarkers(model, "tome-lsp", markers);
    console.log("[LSP Client] First marker:", markers[0]);
  }

  private convertSeverity(severity?: number): monaco.MarkerSeverity {
    switch (severity) {
      case 1:
        return monaco.MarkerSeverity.Error;
      case 2:
        return monaco.MarkerSeverity.Warning;
      case 3:
        return monaco.MarkerSeverity.Info;
      case 4:
        return monaco.MarkerSeverity.Hint;
      default:
        return monaco.MarkerSeverity.Error;
    }
  }

  private handleWorkerError(error: ErrorEvent): void {
    console.error("[LSP Client] Worker error:", error);
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

    console.log("[LSP Client] Initialized with capabilities:", result);
    return result;
  }

  didOpenTextDocument(
    uri: string,
    languageId: string,
    version: number,
    text: string,
  ): void {
    this.modelUri = monaco.Uri.parse(uri);
    console.log("[LSP Client] didOpenTextDocument:", uri, this.modelUri);

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
    console.log("[LSP Client] Shutdown complete");
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
  const client = new LSPClient(workerPath);

  // Initialize the LSP
  await client.initialize();

  // Connect to Monaco
  const cleanup = client.connectToMonaco(editor, uri, languageId);

  return { client, cleanup };
}
