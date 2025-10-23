// types/lsp-protocol.ts
// Simplified LSP protocol types for your custom language

import type { MarkerSeverity } from "../dsl/types.ts";

export type MessageType =
  | "initialize"
  | "initialized"
  | "textDocument/didOpen"
  | "textDocument/didChange"
  | "textDocument/publishDiagnostics"
  | "textDocument/completion"
  | "textDocument/hover"
  | "shutdown";

export interface Position {
  line: number; // 0-based
  character: number; // 0-based
}

export interface Range {
  start: Position;
  end: Position;
}

export interface TextDocumentIdentifier {
  uri: string;
}

export interface VersionedTextDocumentIdentifier
  extends TextDocumentIdentifier {
  version: number;
}

export interface TextDocumentItem {
  uri: string;
  languageId: string;
  version: number;
  text: string;
}

export interface TextDocumentContentChangeEvent {
  range?: Range;
  text: string;
}

export interface Diagnostic {
  range: Range;
  severity: MarkerSeverity;
  code?: string | number;
  source?: string;
  message: string;
}

// Request/Response/Notification base types
export interface RequestMessage {
  id: string | number;
  method: MessageType;
  params?: unknown;
}

export interface ResponseMessage {
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

export interface NotificationMessage {
  method: MessageType;
  params?: unknown;
}

// Specific message params
export interface InitializeParams {
  rootUri: string | null;
  capabilities: unknown;
}

export interface InitializeResult {
  capabilities: {
    textDocumentSync: number; // 1 = Full, 2 = Incremental
    completionProvider?: boolean;
    hoverProvider?: boolean;
  };
}

export interface DidOpenTextDocumentParams {
  textDocument: TextDocumentItem;
}

export interface DidChangeTextDocumentParams {
  textDocument: VersionedTextDocumentIdentifier;
  contentChanges: TextDocumentContentChangeEvent[];
}

export interface PublishDiagnosticsParams {
  uri: string;
  version?: number;
  diagnostics: Diagnostic[];
}
