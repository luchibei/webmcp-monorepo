/**
 * SDK-level structured error for setup/runtime failures.
 */
export class WebMcpSdkError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = "WebMcpSdkError";
    this.code = code;

    if (details !== undefined) {
      this.details = details;
    }
  }
}
