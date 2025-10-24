export class RuntimeError extends Error {
  constructor(
    message: string,
    public line?: number,
    public column?: number,
    public nodeId?: string,
  ) {
    const location = line !== undefined ? ` [Line ${line + 1}]` : "";
    const node = nodeId ? ` in node '${nodeId}'` : "";
    super(`${message}${location}${node}`);
    this.name = "RuntimeError";
  }
}
