export class VariableStore {
  private variables: Map<string, unknown> = new Map();
  private onChange?: (
    name: string,
    oldValue: unknown,
    newValue: unknown,
  ) => void;

  constructor(
    initialVariables?: Record<string, unknown>,
    onChange?: (name: string, oldValue: unknown, newValue: unknown) => void,
  ) {
    this.variables = new Map(Object.entries(initialVariables ?? {}));
    if (onChange) {
      this.onChange = onChange;
    }
  }

  get(name: string): unknown {
    // Loose mode: return 0 if variable doesn't exist
    return this.variables.has(name) ? this.variables.get(name) : 0;
  }

  set(name: string, value: unknown): void {
    const oldValue = this.variables.get(name);
    this.variables.set(name, value);

    // Trigger callback only if value changed
    if (this.onChange && oldValue !== value) {
      this.onChange(name, oldValue, value);
    }
  }

  has(name: string): boolean {
    return this.variables.has(name);
  }

  getAll(): Record<string, unknown> {
    return Object.fromEntries(this.variables);
  }

  clear(): void {
    this.variables.clear();
  }

  setState(state: Record<string, unknown>): void {
    this.variables = new Map(Object.entries(state));
  }
}
