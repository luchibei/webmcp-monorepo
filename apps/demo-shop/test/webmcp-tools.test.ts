import { describe, expect, it, vi } from "vitest";

import { createShopStore } from "../lib/shop-store";
import { createShopTools } from "../lib/webmcp-tools";

function toolByName(name: string) {
  const store = createShopStore();
  const tools = createShopTools(store);
  const tool = tools.find((item) => item.name === name);

  if (!tool) {
    throw new Error(`Tool not found: ${name}`);
  }

  return { store, tool };
}

describe("webmcp macro tools", () => {
  it("searchProducts returns structured matches", async () => {
    const { tool } = toolByName("searchProducts");

    const result = await tool.execute(
      { q: "headphones", limit: 3 },
      {
        requestUserInteraction: async (action) => action()
      }
    );

    expect(result).toMatchObject({ ok: true });
    if (result && typeof result === "object" && "ok" in result && result.ok) {
      expect(result.data.items.length).toBeGreaterThan(0);
    }
  });

  it("addToCart fails with INVALID_INPUT for wrong payload", async () => {
    const { tool } = toolByName("addToCart");

    const result = await tool.execute(
      { productId: "p-aurora-headphones", quantity: "invalid" },
      {
        requestUserInteraction: async (action) => action()
      }
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_INPUT"
      }
    });
  });

  it("placeOrder returns cancellation when user rejects confirmation", async () => {
    const { store, tool } = toolByName("placeOrder");

    store.addToCart("p-aurora-headphones", 1);
    store.setShippingAddress({
      name: "Sam",
      phone: "555-0101",
      address: "500 Pine St"
    });

    const pending = tool.execute(
      {},
      {
        requestUserInteraction: async (action) => action()
      }
    );

    await vi.waitFor(() => {
      expect(store.getState().pendingConfirmation).not.toBeNull();
    });

    store.resolveOrderConfirmation(false);
    const result = await pending;

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "ORDER_CANCELLED"
      }
    });
  });

  it("placeOrder confirms and returns order id", async () => {
    const { store, tool } = toolByName("placeOrder");

    store.addToCart("p-aurora-headphones", 1);
    store.setShippingAddress({
      name: "Sam",
      phone: "555-0101",
      address: "500 Pine St"
    });

    const pending = tool.execute(
      {},
      {
        requestUserInteraction: async (action) => action()
      }
    );

    await vi.waitFor(() => {
      expect(store.getState().pendingConfirmation).not.toBeNull();
    });

    store.resolveOrderConfirmation(true);
    const result = await pending;

    expect(result).toMatchObject({
      ok: true,
      data: {
        status: "confirmed"
      }
    });
  });
});
