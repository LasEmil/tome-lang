import type { RuntimeError } from "./errors.ts";

export interface DialogueFrame {
  nodeId: string; // Starting node ID for this frame
  nodeHistory: string[]; // All nodes visited in this frame (for goto chains)
  dialogue: string[]; // All 'say' statements collected
  choices: ChoiceOption[]; // Available choices (condition-filtered)
  variables: Record<string, unknown>; // Current variable snapshot
}

export interface ChoiceOption {
  text: string;
  target: string;
  index: number;
}

export interface UserChoice {
  choiceIndex: number;
}

export interface RuntimeState {
  variables: Record<string, unknown>;
  visitedNodes: string[];
  frameCount: number;
}

export interface RuntimeCallbacks {
  onNodeEnter?: (nodeId: string, variables: Record<string, unknown>) => void;
  onNodeExit?: (nodeId: string) => void;
  onVariableChange?: (
    name: string,
    oldValue: unknown,
    newValue: unknown,
  ) => void;
  onError?: (error: RuntimeError) => void;
  onDialogueCollected?: (text: string) => void;
}

export interface RuntimeOptions {
  startNode?: string;
  initialVariables?: Record<string, unknown>;
  callbacks?: RuntimeCallbacks;
  maxGotoDepth?: number; // Default: 100
}
