export class LspLogger {
  constructor(
    public type: "client" | "worker" | "editor",
    public enabled = false,
  ) {}

  public log(message: string, ...args: unknown[]) {
    if (this.enabled) {
      console.log(this.message(message), ...args);
    }
  }

  public warn(message: string, ...args: unknown[]) {
    if (this.enabled) {
      console.warn(this.message(message), ...args);
    }
  }

  public error(message: string, ...args: unknown[]) {
    if (this.enabled) {
      console.error(this.message(message), ...args);
    }
  }

  private message(message: string): string {
    return `[LSP ${this.type}] ${message}`;
  }
}
