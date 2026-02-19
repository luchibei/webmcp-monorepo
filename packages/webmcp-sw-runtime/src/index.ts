export const WEBMCP_SW_RUNTIME_VERSION = "0.1.0";

export { createSwToolBridge, getActiveSwToolBridge } from "./bridge.js";
export type { CreateSwToolBridgeOptions, SwToolBridge } from "./bridge.js";

export { defineSwBackedTool } from "./define-sw-backed-tool.js";
export type { DefineSwBackedToolOptions } from "./define-sw-backed-tool.js";

export { createSwRouter } from "./sw-router.js";
export type {
  CreateSwRouterOptions,
  SwHandlerDefinition,
  SwRouterController,
  SwRouterHandlers
} from "./sw-router.js";

export {
  WEBMCP_TOOL_CALL,
  WEBMCP_TOOL_RESULT,
  type SwToolCallMessage,
  type SwToolResultMessage
} from "./protocol.js";
