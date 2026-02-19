export const WEBMCP_SDK_VERSION = "0.1.0";

export { defineTool } from "./define-tool.js";
export type { DefineToolOptions, DefinedTool } from "./define-tool.js";

export { WebMcpSdkError } from "./errors.js";

export {
  clearContextSafe,
  getModelContext,
  isWebMcpSupported,
  provideContextSafe,
  registerToolsSafe,
  registerToolSafe,
  unregisterToolSafe
} from "./model-context.js";
export type {
  RegisterToolsSafeOptions,
  RegisterToolSafeOptions,
  UnregisterAllHandle,
  UnregisterHandle
} from "./model-context.js";

export { createToolPolicy, evaluateToolPolicy } from "./policy.js";
export type {
  CreateToolPolicyOptions,
  ToolPolicy,
  ToolPolicyContext,
  ToolPolicyResult
} from "./policy.js";

export { getToolRisk, inferToolRisk } from "./risk.js";

export { fail, isToolResponse, ok } from "./response.js";
export type { ToolError, ToolResponse, ToolResponseMetadata } from "./response.js";

export type {
  MaybePromise,
  ModelContext,
  ModelContextClient,
  ModelContextOptions,
  ModelContextTool,
  ToolAnnotations,
  ToolRisk
} from "./types.js";
