import { create } from "zustand";

type RuntimeState = {
  dialogues: string[];
  choices: any[];
  variables: Record<string, any>;
  isFinished: boolean;
};
export const useRuntimeState = create<RuntimeState>(() => ({
  dialogues: [],
  choices: [],
  variables: {},
  isFinished: false,
}));
