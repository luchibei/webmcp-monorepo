import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  clearContextSafe,
  createToolPolicy,
  defineTool,
  fail,
  getModelContext,
  inferToolRisk,
  isWebMcpSupported,
  ok,
  provideContextSafe,
  registerToolsSafe,
  registerToolSafe,
  type ModelContext,
  type ModelContextClient,
  unregisterToolSafe
} from "../src/index";

const client: ModelContextClient = {
  requestUserInteraction: async <T>(action: () => T | Promise<T>) => action()
};

function createTestTool(name = "searchProducts") {
  return defineTool({
    name,
    description: "Search products by keyword",
    input: z.object({
      keyword: z.string().min(1),
      limit: z.number().int().positive().max(20).optional()
    }),
    readOnlyHint: true,
    execute: async (input) => ok({ query: input.keyword, total: input.limit ?? 5 })
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("defineTool", () => {
  it("generates JSON schema from zod", () => {
    const tool = createTestTool();

    expect(tool.name).toBe("searchProducts");
    expect(tool.description).toBe("Search products by keyword");
    expect(tool.inputSchema).toMatchObject({
      type: "object",
      properties: {
        keyword: {
          type: "string"
        }
      },
      required: ["keyword"]
    });
    expect(tool.annotations).toEqual({ readOnlyHint: true });
    expect(inferToolRisk(tool)).toBe("read");
  });

  it("returns fail response when input validation fails", async () => {
    const tool = createTestTool();

    const result = await tool.execute({ keyword: 123 }, client);

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: "Tool input validation failed."
      },
      metadata: {
        risk: "read"
      }
    });
  });

  it("returns fail response when execute throws", async () => {
    const tool = defineTool({
      name: "placeOrder",
      description: "Place order",
      input: z.object({ orderId: z.string() }),
      execute: async () => {
        throw new Error("Database unavailable");
      }
    });

    const result = await tool.execute({ orderId: "o_1001" }, client);

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "TOOL_EXECUTION_ERROR",
        message: "Database unavailable"
      },
      metadata: {
        risk: "write"
      }
    });
  });

  it("maps risk to readOnlyHint and preserves risk metadata", async () => {
    const tool = defineTool({
      name: "placeOrder",
      description: "Place an order with payment authorization",
      risk: "payment",
      input: z.object({}),
      execute: async () => {
        return fail("PAYMENT_DECLINED", "Card declined");
      }
    });

    expect(tool.annotations).toEqual({ readOnlyHint: false });

    const result = await tool.execute({}, client);
    expect(result).toMatchObject({
      ok: false,
      metadata: {
        risk: "payment"
      }
    });
  });

  it("preserves custom success return value", async () => {
    const tool = defineTool({
      name: "customTool",
      description: "Return custom payload",
      input: z.object({ id: z.string() }),
      execute: async (input) => ({ id: input.id, custom: true })
    });

    const result = await tool.execute({ id: "abc" }, client);

    expect(result).toEqual({ id: "abc", custom: true });
  });

  it("injects risk metadata when execute returns ToolResponse", async () => {
    const tool = defineTool({
      name: "updateProfile",
      description: "Update profile",
      risk: "write",
      input: z.object({ userId: z.string() }),
      execute: async () => ok({ updated: true })
    });

    const result = await tool.execute({ userId: "u1" }, client);
    expect(result).toMatchObject({
      ok: true,
      data: {
        updated: true
      },
      metadata: {
        risk: "write"
      }
    });
  });

  it("throws when risk conflicts with readOnlyHint", () => {
    expect(() =>
      defineTool({
        name: "badRiskConfig",
        description: "conflict",
        risk: "payment",
        readOnlyHint: true,
        input: z.object({}),
        execute: async () => ok({})
      })
    ).toThrowError(/conflicts with readOnlyHint/i);
  });

  it("throws explicit schema generation error when conversion fails", () => {
    const circularSchema: z.ZodTypeAny = z.lazy(() => circularSchema);

    expect(() =>
      defineTool({
        name: "badSchemaTool",
        description: "schema fail case",
        input: circularSchema,
        execute: async () => "ok"
      })
    ).toThrowError(/SCHEMA_GENERATION_FAILED|Failed to generate inputSchema/i);
  });
});

describe("safe wrappers", () => {
  it("registerToolSafe is safe when WebMCP is unavailable", async () => {
    vi.stubGlobal("navigator", {});

    const handle = await registerToolSafe(createTestTool("safeUnavailable"));

    await expect(handle.unregister()).resolves.toBeUndefined();
  });

  it("provideContextSafe and clearContextSafe are no-op when unavailable", async () => {
    vi.stubGlobal("navigator", {});

    await expect(
      provideContextSafe({ tools: [createTestTool("contextTool")] })
    ).resolves.toBeUndefined();
    await expect(clearContextSafe()).resolves.toBeUndefined();
  });

  it("uses available modelContext methods and awaits async/sync returns", async () => {
    const registerTool = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    const provideContext = vi.fn(() => undefined);
    const clearContext = vi.fn(async () => undefined);
    const unregisterTool = vi.fn(() => undefined);

    const modelContext: ModelContext = {
      provideContext,
      registerTool,
      clearContext,
      unregisterTool
    };

    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("navigator", { modelContext });

    const tool = createTestTool("registeredTool");

    expect(isWebMcpSupported()).toBe(true);
    expect(getModelContext()).toBe(modelContext);

    const handle = await registerToolSafe(tool);
    await provideContextSafe({ tools: [tool] });
    await clearContextSafe();
    await unregisterToolSafe(tool.name);
    await handle.unregister();

    expect(registerTool).toHaveBeenCalledWith(tool);
    expect(provideContext).toHaveBeenCalledWith({ tools: [tool] });
    expect(clearContext).toHaveBeenCalledTimes(1);
    expect(unregisterTool).toHaveBeenCalledWith(tool.name);
  });

  it("registerToolsSafe returns unregisterAll handle", async () => {
    const unregisterTool = vi.fn(async () => undefined);

    const modelContext: ModelContext = {
      provideContext: vi.fn(),
      registerTool: vi.fn(),
      clearContext: vi.fn(),
      unregisterTool
    };

    vi.stubGlobal("navigator", { modelContext });
    vi.stubGlobal("isSecureContext", true);

    const tools = [createTestTool("a"), createTestTool("b")];
    const handle = await registerToolsSafe(tools);

    await handle.unregisterAll();

    expect(unregisterTool).toHaveBeenNthCalledWith(1, "b");
    expect(unregisterTool).toHaveBeenNthCalledWith(2, "a");
  });

  it("registerToolSafe respects deny policy", async () => {
    const registerTool = vi.fn();

    const modelContext: ModelContext = {
      provideContext: vi.fn(),
      registerTool,
      clearContext: vi.fn(),
      unregisterTool: vi.fn()
    };

    vi.stubGlobal("navigator", { modelContext });
    vi.stubGlobal("isSecureContext", true);

    const writeTool = defineTool({
      name: "writeTool",
      description: "write",
      risk: "write",
      input: z.object({}),
      execute: async () => ok({ done: true })
    });

    const policy = createToolPolicy({ defaultDenyWrite: true });
    await registerToolSafe(writeTool, { policy });

    expect(registerTool).not.toHaveBeenCalled();
  });

  it("registerToolsSafe policy can block payment tools", async () => {
    const registerTool = vi.fn();

    const modelContext: ModelContext = {
      provideContext: vi.fn(),
      registerTool,
      clearContext: vi.fn(),
      unregisterTool: vi.fn()
    };

    vi.stubGlobal("navigator", { modelContext });
    vi.stubGlobal("isSecureContext", true);

    const tools = [
      defineTool({
        name: "readTool",
        description: "read",
        risk: "read",
        input: z.object({}),
        execute: async () => ok({})
      }),
      defineTool({
        name: "paymentTool",
        description: "payment",
        risk: "payment",
        input: z.object({}),
        execute: async () => ok({})
      })
    ];

    const policy = createToolPolicy({
      requireConfirmationForRisk: ["payment"]
    });

    await registerToolsSafe(tools, { policy });

    expect(registerTool).toHaveBeenCalledTimes(1);
    expect(registerTool).toHaveBeenCalledWith(expect.objectContaining({ name: "readTool" }));
  });

  it("reports unsupported when runtime is insecure", () => {
    const modelContext: ModelContext = {
      provideContext: vi.fn(),
      registerTool: vi.fn(),
      clearContext: vi.fn(),
      unregisterTool: vi.fn()
    };

    vi.stubGlobal("navigator", { modelContext });
    vi.stubGlobal("isSecureContext", false);

    expect(getModelContext()).toBeNull();
    expect(isWebMcpSupported()).toBe(false);
  });
});
