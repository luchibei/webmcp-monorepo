/**
 * Message type for requests from page to service worker.
 */
export const WEBMCP_TOOL_CALL = "WEBMCP_TOOL_CALL" as const;

/**
 * Message type for responses from service worker to page.
 */
export const WEBMCP_TOOL_RESULT = "WEBMCP_TOOL_RESULT" as const;

/**
 * Request payload posted to service worker.
 */
export interface SwToolCallMessage {
  type: typeof WEBMCP_TOOL_CALL;
  requestId?: string;
  tool?: string;
  method?: string;
  input?: unknown;
  payload?: unknown;
}

/**
 * Response payload posted back to page.
 */
export interface SwToolResultMessage {
  type: typeof WEBMCP_TOOL_RESULT;
  requestId?: string;
  tool?: string;
  response: unknown;
}
