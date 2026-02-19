import { defineTool } from "@luchibei/webmcp-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { WEBMCP_TOOL_CALL, WEBMCP_TOOL_RESULT, createSwRouter } from "../src/index";

type MessageHandler = (event: {
  data: unknown;
  source?: { postMessage: (message: unknown) => void };
}) => void;

class FakeScope {
  handlers = new Set<MessageHandler>();
  agent?: {
    registerTool: ReturnType<typeof vi.fn>;
    provideContext: ReturnType<typeof vi.fn>;
  };

  addEventListener(_type: "message", handler: MessageHandler) {
    this.handlers.add(handler);
  }

  removeEventListener(_type: "message", handler: MessageHandler) {
    this.handlers.delete(handler);
  }

  dispatch(data: unknown, source: { postMessage: (message: unknown) => void }) {
    this.handlers.forEach((handler) => handler({ data, source }));
  }
}

class FakeSource {
  messages: unknown[] = [];

  postMessage(message: unknown) {
    this.messages.push(message);
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createSwRouter", () => {
  it("routes message to handler and responds with ok payload", async () => {
    const scope = new FakeScope();
    const source = new FakeSource();

    createSwRouter(
      {
        sum: {
          input: z.object({ a: z.number(), b: z.number() }),
          execute: async (input) => ({ total: input.a + input.b })
        }
      },
      { scope }
    );

    scope.dispatch(
      {
        type: WEBMCP_TOOL_CALL,
        requestId: "req_1",
        tool: "sum",
        input: { a: 4, b: 7 }
      },
      source
    );

    await Promise.resolve();

    expect(source.messages[0]).toMatchObject({
      type: WEBMCP_TOOL_RESULT,
      requestId: "req_1",
      tool: "sum",
      response: {
        ok: true,
        data: {
          total: 11
        }
      }
    });
  });

  it("returns handler-not-found error when command is missing", async () => {
    const scope = new FakeScope();
    const source = new FakeSource();

    createSwRouter({}, { scope });

    scope.dispatch(
      {
        type: WEBMCP_TOOL_CALL,
        requestId: "req_missing",
        tool: "unknownTool",
        input: {}
      },
      source
    );

    await Promise.resolve();

    expect(source.messages[0]).toMatchObject({
      response: {
        ok: false,
        error: {
          code: "SW_HANDLER_NOT_FOUND"
        }
      }
    });
  });

  it("returns invalid-input error when schema validation fails", async () => {
    const scope = new FakeScope();
    const source = new FakeSource();

    createSwRouter(
      {
        strictTool: {
          input: z.object({ qty: z.number().int().positive() }),
          execute: async () => ({ done: true })
        }
      },
      { scope }
    );

    scope.dispatch(
      {
        type: WEBMCP_TOOL_CALL,
        requestId: "req_invalid",
        tool: "strictTool",
        input: { qty: "bad" }
      },
      source
    );

    await Promise.resolve();

    expect(source.messages[0]).toMatchObject({
      response: {
        ok: false,
        error: {
          code: "INVALID_INPUT"
        }
      }
    });
  });

  it("returns handler error when execution throws", async () => {
    const scope = new FakeScope();
    const source = new FakeSource();

    createSwRouter(
      {
        explodingTool: {
          input: z.object({ id: z.string() }),
          execute: async () => {
            throw new Error("database offline");
          }
        }
      },
      { scope }
    );

    scope.dispatch(
      {
        type: WEBMCP_TOOL_CALL,
        requestId: "req_explode",
        tool: "explodingTool",
        input: { id: "x" }
      },
      source
    );

    await Promise.resolve();

    expect(source.messages[0]).toMatchObject({
      response: {
        ok: false,
        error: {
          code: "SW_HANDLER_ERROR"
        }
      }
    });
  });

  it("supports mode-1 direct registration via scope.agent", async () => {
    const scope = new FakeScope();
    scope.agent = {
      registerTool: vi.fn(async () => undefined),
      provideContext: vi.fn(async () => undefined)
    };

    const router = createSwRouter({}, { scope });
    const demoTool = defineTool({
      name: "swDirectTool",
      description: "direct registration demo",
      input: z.object({}),
      execute: async () => ({ ok: true })
    });

    expect(router.isDirectRegistrationAvailable()).toBe(true);

    const result = await router.registerDirectTools([demoTool], "registerTool");

    expect(result).toBe(true);
    expect(scope.agent.registerTool).toHaveBeenCalledWith(demoTool);
  });
});
