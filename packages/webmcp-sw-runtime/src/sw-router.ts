import {
  fail,
  isToolResponse,
  ok,
  type MaybePromise,
  type ModelContextOptions,
  type ModelContextTool,
  type ToolResponse
} from "@luchibei/webmcp-sdk";
import type { z } from "zod";

import { WEBMCP_TOOL_CALL, WEBMCP_TOOL_RESULT, type SwToolCallMessage } from "./protocol.js";

type MessageSourceLike = {
  postMessage: (payload: unknown) => void;
};

type MessagePortLike = {
  postMessage: (payload: unknown) => void;
};

type MessageEventLike = {
  data: unknown;
  source?: MessageSourceLike | null;
  ports?: MessagePortLike[];
};

type MessageScopeLike = {
  addEventListener: (eventName: "message", handler: (event: MessageEventLike) => void) => void;
  removeEventListener: (eventName: "message", handler: (event: MessageEventLike) => void) => void;
};

type ModelContextLike = {
  provideContext?: (options: ModelContextOptions) => void | Promise<void>;
  registerTool?: (tool: ModelContextTool) => void | Promise<void>;
};

/**
 * Handler definition used in service worker routing.
 */
export interface SwHandlerDefinition<
  TInputSchema extends z.ZodTypeAny = z.ZodTypeAny,
  TResult = unknown
> {
  input: TInputSchema;
  execute: (
    input: z.infer<TInputSchema>
  ) => MaybePromise<TResult | ToolResponse<TResult> | ToolResponse<never>>;
}

/**
 * Service worker command map.
 */
export type SwRouterHandlers = Record<string, SwHandlerDefinition>;

/**
 * Router behavior options.
 */
export interface CreateSwRouterOptions {
  scope?: MessageScopeLike;
}

/**
 * Router control handle.
 */
export interface SwRouterController {
  mode: "agent" | "postMessage";
  isDirectRegistrationAvailable(): boolean;
  registerDirectTools(
    tools: ModelContextTool[],
    strategy?: "registerTool" | "provideContext"
  ): Promise<boolean>;
  dispose(): void;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isToolCallMessage(value: unknown): value is SwToolCallMessage {
  return isObject(value) && value.type === WEBMCP_TOOL_CALL;
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

function getMessageTarget(event: MessageEventLike): MessageSourceLike | MessagePortLike | null {
  if (event.source && typeof event.source.postMessage === "function") {
    return event.source;
  }

  if (event.ports && event.ports.length > 0) {
    const firstPort = event.ports[0];
    if (firstPort && typeof firstPort.postMessage === "function") {
      return firstPort;
    }
  }

  return null;
}

function extractToolName(payload: SwToolCallMessage): string | null {
  if (typeof payload.method === "string" && payload.method.trim()) {
    return payload.method;
  }

  if (typeof payload.tool === "string" && payload.tool.trim()) {
    return payload.tool;
  }

  if (isObject(payload.payload) && typeof payload.payload.tool === "string") {
    return payload.payload.tool;
  }

  return null;
}

function extractRawInput(payload: SwToolCallMessage): unknown {
  if (payload.input !== undefined) {
    return payload.input;
  }

  if (isObject(payload.payload) && "input" in payload.payload) {
    return payload.payload.input;
  }

  return payload.payload;
}

function getModelContextLike(scope: unknown): ModelContextLike | null {
  if (!isObject(scope)) {
    return null;
  }

  const candidates: unknown[] = [
    (scope as { agent?: unknown }).agent,
    (scope as { modelContext?: unknown }).modelContext,
    (scope as { self?: { agent?: unknown; modelContext?: unknown } }).self?.agent,
    (scope as { self?: { agent?: unknown; modelContext?: unknown } }).self?.modelContext,
    (scope as { navigator?: { modelContext?: unknown } }).navigator?.modelContext
  ];

  for (const candidate of candidates) {
    if (!isObject(candidate)) {
      continue;
    }

    const hasRegisterTool = typeof candidate.registerTool === "function";
    const hasProvideContext = typeof candidate.provideContext === "function";

    if (hasRegisterTool || hasProvideContext) {
      return candidate as ModelContextLike;
    }
  }

  return null;
}

/**
 * Creates a service worker message router for WebMCP bridge calls.
 */
export function createSwRouter(
  handlers: SwRouterHandlers,
  options: CreateSwRouterOptions = {}
): SwRouterController {
  const scope = options.scope ?? (globalThis as unknown as MessageScopeLike);
  const modelContext = getModelContextLike(scope);

  const onMessage = async (event: MessageEventLike) => {
    const target = getMessageTarget(event);
    if (!target) {
      return;
    }

    const payload = event.data;
    if (!isToolCallMessage(payload)) {
      return;
    }

    const request = payload;
    const requestId = request.requestId;
    const toolName = extractToolName(request);

    if (!toolName) {
      target.postMessage({
        type: WEBMCP_TOOL_RESULT,
        requestId,
        response: fail("SW_INVALID_REQUEST", "Missing SW handler key (tool/method).")
      });
      return;
    }

    const handler = handlers[toolName];
    if (!handler) {
      target.postMessage({
        type: WEBMCP_TOOL_RESULT,
        requestId,
        tool: toolName,
        response: fail("SW_HANDLER_NOT_FOUND", `No service worker handler for "${toolName}".`)
      });
      return;
    }

    const rawInput = extractRawInput(request);
    const parseResult = handler.input.safeParse(rawInput);
    if (!parseResult.success) {
      target.postMessage({
        type: WEBMCP_TOOL_RESULT,
        requestId,
        tool: toolName,
        response: fail("INVALID_INPUT", "Service Worker handler input validation failed.", {
          issues: parseResult.error.issues
        })
      });
      return;
    }

    try {
      const result = await handler.execute(parseResult.data);
      target.postMessage({
        type: WEBMCP_TOOL_RESULT,
        requestId,
        tool: toolName,
        response: isToolResponse(result) ? result : ok(result)
      });
    } catch (error) {
      target.postMessage({
        type: WEBMCP_TOOL_RESULT,
        requestId,
        tool: toolName,
        response: fail("SW_HANDLER_ERROR", "Service Worker handler threw an error.", {
          cause: toErrorDetails(error)
        })
      });
    }
  };

  scope.addEventListener("message", onMessage);

  return {
    mode: modelContext ? "agent" : "postMessage",
    isDirectRegistrationAvailable() {
      return Boolean(modelContext);
    },
    async registerDirectTools(tools, strategy = "registerTool") {
      if (!modelContext) {
        return false;
      }

      try {
        if (strategy === "provideContext" && typeof modelContext.provideContext === "function") {
          await Promise.resolve(modelContext.provideContext({ tools }));
          return true;
        }

        if (typeof modelContext.registerTool === "function") {
          for (const tool of tools) {
            await Promise.resolve(modelContext.registerTool(tool));
          }
          return true;
        }

        return false;
      } catch {
        return false;
      }
    },
    dispose() {
      scope.removeEventListener("message", onMessage);
    }
  };
}
