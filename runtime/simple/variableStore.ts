export class VariableStore {
  private variables: Map<string, any>;
  private onChange?: (name: string, oldValue: any, newValue: any) => void;

  constructor(
    initialVariables?: Record<string, any>,
    onChange?: (name: string, oldValue: any, newValue: any) => void,
  ) {
    this.variables = new Map(Object.entries(initialVariables ?? {}));
    this.onChange = onChange;
  }

  get(name: string): any {
    // Loose mode: return 0 if variable doesn't exist
    return this.variables.has(name) ? this.variables.get(name) : 0;
  }

  set(name: string, value: any): void {
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

  getAll(): Record<string, any> {
    return Object.fromEntries(this.variables);
  }

  clear(): void {
    this.variables.clear();
  }

  setState(state: Record<string, any>): void {
    this.variables = new Map(Object.entries(state));
  }
}
