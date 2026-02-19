import type { ModelContextClient } from "@webmcp/webmcp-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  WEBMCP_TOOL_CALL,
  WEBMCP_TOOL_RESULT,
  createSwToolBridge,
  defineSwBackedTool
} from "../src/index";

class FakeWorker {
  postMessageImpl?: (message: Record<string, unknown>) => void;

  postMessage = vi.fn((message: Record<string, unknown>) => {
    this.postMessageImpl?.(message);
  });
}

class FakeServiceWorkerContainer {
  worker = new FakeWorker();
  listeners = new Set<(event: MessageEvent) => void>();
  controller: FakeWorker | null = this.worker;

  register = vi.fn(async () => ({
    active: this.worker,
    waiting: null,
    installing: null
  }));

  getRegistration = vi.fn(async () => ({
    active: this.worker,
    waiting: null,
    installing: null
  }));

  ready = Promise.resolve({ active: this.worker });

  addEventListener = vi.fn((_: "message", listener: (event: MessageEvent) => void) => {
    this.listeners.add(listener);
  });

  removeEventListener = vi.fn((_: "message", listener: (event: MessageEvent) => void) => {
    this.listeners.delete(listener);
  });

  emitMessage(data: unknown) {
    const event = { data } as MessageEvent;
    this.listeners.forEach((listener) => listener(event));
  }
}

const client: ModelContextClient = {
  requestUserInteraction: async <T>(action: () => T | Promise<T>) => action()
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("createSwToolBridge + defineSwBackedTool", () => {
  it("sends message to service worker and receives structured response", async () => {
    const container = new FakeServiceWorkerContainer();
    container.worker.postMessageImpl = (message) => {
      const requestId = message.requestId as string;

      container.emitMessage({
        type: WEBMCP_TOOL_RESULT,
        requestId,
        response: {
          ok: true,
          data: {
            source: "service-worker"
          }
        }
      });
    };

    vi.stubGlobal("navigator", {
      serviceWorker: container
    });

    const bridge = createSwToolBridge({
      serviceWorkerPath: "/demo-sw.js",
      timeoutMs: 100
    });

    const result = await bridge.callInSw("prepareCheckout", {
      tool: "prepareCheckout",
      input: {}
    });

    expect(result).toMatchObject({
      ok: true,
      data: {
        source: "service-worker"
      }
    });

    expect(container.worker.postMessage).toHaveBeenCalled();
    expect(container.worker.postMessage.mock.calls[0]?.[0]).toMatchObject({
      type: WEBMCP_TOOL_CALL,
      method: "prepareCheckout",
      tool: "prepareCheckout",
      input: {}
    });
  });

  it("returns timeout failure when service worker does not respond", async () => {
    const container = new FakeServiceWorkerContainer();

    vi.stubGlobal("navigator", {
      serviceWorker: container
    });

    const bridge = createSwToolBridge({
      serviceWorkerPath: "/demo-sw.js",
      timeoutMs: 10
    });

    const result = await bridge.callInSw("prepareCheckout", {
      tool: "prepareCheckout",
      input: {}
    });

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "SW_TIMEOUT"
      }
    });
  });

  it("uses executeFallback when service worker API is unavailable", async () => {
    vi.stubGlobal("navigator", {});

    createSwToolBridge({ serviceWorkerPath: "/demo-sw.js", timeoutMs: 20 });

    const tool = defineSwBackedTool({
      name: "prepareCheckout",
      description: "prepare checkout summary",
      input: z.object({}),
      swCommand: "prepareCheckout",
      executeFallback: async () => ({ preparedBy: "page-fallback" })
    });

    const result = await tool.execute({}, client);

    expect(result).toEqual({ preparedBy: "page-fallback" });
  });

  it("defineSwBackedTool posts WEBMCP_TOOL_CALL shape with tool and input", async () => {
    const container = new FakeServiceWorkerContainer();
    let lastRequest: Record<string, unknown> | null = null;

    container.worker.postMessageImpl = (message) => {
      lastRequest = message;
      container.emitMessage({
        type: WEBMCP_TOOL_RESULT,
        requestId: message.requestId,
        response: {
          ok: true,
          data: {
            accepted: true
          }
        }
      });
    };

    vi.stubGlobal("navigator", {
      serviceWorker: container
    });

    createSwToolBridge({
      serviceWorkerPath: "/demo-sw.js",
      timeoutMs: 80
    });

    const tool = defineSwBackedTool({
      name: "prepareCheckout",
      description: "prepare checkout in service worker",
      input: z.object({ orderId: z.string() }),
      swCommand: "prepareCheckoutInWorker"
    });

    const result = await tool.execute({ orderId: "ord_1" }, client);

    expect(result).toMatchObject({
      ok: true,
      data: {
        accepted: true
      }
    });

    expect(lastRequest).toMatchObject({
      type: WEBMCP_TOOL_CALL,
      tool: "prepareCheckout",
      method: "prepareCheckoutInWorker",
      input: {
        orderId: "ord_1"
      }
    });
  });
});
