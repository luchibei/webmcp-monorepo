import {
  defineTool,
  fail,
  isToolResponse,
  type MaybePromise,
  type ModelContextClient,
  type ModelContextTool
} from "@webmcp/webmcp-sdk";
import type { z } from "zod";

import { getActiveSwToolBridge } from "./bridge.js";
import { WEBMCP_TOOL_CALL } from "./protocol.js";

/**
 * Input options for a service-worker-backed WebMCP tool.
 */
export interface DefineSwBackedToolOptions<
  TInputSchema extends z.ZodTypeAny,
  TFallbackResult = unknown
> {
  name: string;
  description: string;
  input: TInputSchema;
  readOnlyHint?: boolean;

  /**
   * Service worker command key. Defaults to `name`.
   */
  swCommand?: string;

  /**
   * Optional page-side fallback used when SW is unavailable or times out.
   */
  executeFallback?: (
    input: z.infer<TInputSchema>,
    client: ModelContextClient
  ) => MaybePromise<TFallbackResult>;
}

function shouldUseFallback(errorCode: string): boolean {
  return ["SW_UNAVAILABLE", "SW_NOT_READY", "SW_TIMEOUT", "SW_POSTMESSAGE_FAILED"].includes(
    errorCode
  );
}

function toErrorDetails(error: unknown): unknown {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return error;
}

/**
 * Defines a WebMCP tool whose execution is delegated to service worker via postMessage.
 */
export function defineSwBackedTool<TInputSchema extends z.ZodTypeAny, TFallbackResult = unknown>(
  options: DefineSwBackedToolOptions<TInputSchema, TFallbackResult>
): ModelContextTool {
  const command = options.swCommand ?? options.name;

  const tool = defineTool({
    name: options.name,
    description: options.description,
    input: options.input,
    ...(options.readOnlyHint !== undefined ? { readOnlyHint: options.readOnlyHint } : {}),
    execute: async (input, client) => {
      const bridge = getActiveSwToolBridge();
      if (!bridge) {
        if (options.executeFallback) {
          return options.executeFallback(input, client);
        }

        return fail("SW_UNAVAILABLE", "Service Worker bridge has not been initialized.");
      }

      const swResponse = await bridge.callInSw(command, {
        type: WEBMCP_TOOL_CALL,
        tool: options.name,
        command,
        input
      });

      if (swResponse.ok) {
        return swResponse;
      }

      if (options.executeFallback && shouldUseFallback(swResponse.error.code)) {
        try {
          return await options.executeFallback(input, client);
        } catch (error) {
          return fail("SW_FALLBACK_ERROR", "Page-side fallback execution failed.", {
            cause: toErrorDetails(error)
          });
        }
      }

      if (isToolResponse(swResponse)) {
        return swResponse;
      }

      return fail("SW_CALL_FAILED", "Service Worker-backed tool execution failed.");
    }
  });

  return tool as unknown as ModelContextTool;
}
