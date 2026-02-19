/**
 * Promise-compatible return type used by WebMCP methods.
 */
export type MaybePromise<T> = T | Promise<T>;

/**
 * Optional upper-layer risk classification for tool behavior.
 */
export type ToolRisk = "read" | "write" | "payment";

/**
 * Optional tool annotations understood by WebMCP implementations.
 */
export interface ToolAnnotations {
  /**
   * Hints that this tool should not modify state.
   */
  readOnlyHint?: boolean;
}

/**
 * Client object provided by WebMCP when executing a tool.
 */
export interface ModelContextClient {
  /**
   * Requests explicit user interaction for sensitive operations.
   */
  requestUserInteraction<T>(action: () => MaybePromise<T>): Promise<T>;
}

/**
 * Tool shape accepted by `navigator.modelContext`.
 */
export interface ModelContextTool<TInput = unknown, TResult = unknown> {
  /**
   * Unique tool name.
   */
  name: string;

  /**
   * Human-readable description.
   */
  description: string;

  /**
   * JSON Schema input definition.
   */
  inputSchema: Record<string, unknown>;

  /**
   * Tool executor.
   */
  execute: (input: TInput, client: ModelContextClient) => MaybePromise<TResult>;

  /**
   * Optional runtime hints.
   */
  annotations?: ToolAnnotations;
}

/**
 * Options passed to `navigator.modelContext.provideContext`.
 */
export interface ModelContextOptions {
  tools: ModelContextTool[];
}

/**
 * Browser WebMCP model context interface.
 */
export interface ModelContext {
  provideContext(options: ModelContextOptions): void | Promise<void>;
  registerTool(tool: ModelContextTool): void | Promise<void>;
  clearContext(): void | Promise<void>;
  unregisterTool(name: string): void | Promise<void>;
}
