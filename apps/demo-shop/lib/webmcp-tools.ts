import {
  defineTool,
  fail,
  ok,
  type ModelContextClient,
  type ModelContextTool,
  type ToolResponse
} from "@webmcp/webmcp-sdk";
import { defineSwBackedTool } from "@webmcp/webmcp-sw-runtime";
import { z } from "zod";

import { getShopSwBridge } from "./sw-bridge";
import { ShopStore, shopStore } from "./shop-store";
import type { ProductSearchFilters } from "./types";

void getShopSwBridge();

const searchFiltersSchema = z
  .object({
    category: z.enum(["audio", "home", "wearable", "productivity", "gaming"]).optional(),
    minPrice: z.number().nonnegative().optional(),
    maxPrice: z.number().nonnegative().optional(),
    inStockOnly: z.boolean().optional()
  })
  .optional();

function toStructuredProduct(product: {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  rating: number;
  image: string;
}) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    category: product.category,
    price: product.price,
    stock: product.stock,
    rating: product.rating,
    image: product.image
  };
}

/**
 * Creates high-level shopping tools for the demo site.
 */
export function createShopTools(store: ShopStore): ModelContextTool[] {
  const searchProductsTool = defineTool({
    name: "searchProducts",
    description: "Search products by query, optional limit, and structured filters.",
    input: z.object({
      q: z.string().default(""),
      limit: z.number().int().positive().max(20).optional(),
      filters: searchFiltersSchema
    }),
    readOnlyHint: true,
    execute: async (input) => {
      const searchArgs = {
        q: input.q,
        ...(input.limit !== undefined ? { limit: input.limit } : {}),
        ...(input.filters !== undefined ? { filters: input.filters as ProductSearchFilters } : {})
      };

      const items = store.searchProducts(searchArgs);

      return ok({
        totalMatched: items.length,
        items: items.map(toStructuredProduct)
      });
    }
  });

  const getProductTool = defineTool({
    name: "getProduct",
    description: "Get one product by id with full structured details.",
    input: z.object({
      id: z.string().min(1)
    }),
    readOnlyHint: true,
    execute: async (input) => {
      const product = store.getProduct(input.id);
      if (!product) {
        return fail("NOT_FOUND", "Product not found.", { id: input.id });
      }

      return ok(toStructuredProduct(product));
    }
  });

  const addToCartTool = defineTool({
    name: "addToCart",
    description: "Add a product to cart and return an updated cart summary.",
    input: z.object({
      productId: z.string().min(1),
      quantity: z.number().int().positive().max(20)
    }),
    execute: async (input) => {
      try {
        const cart = store.addToCart(input.productId, input.quantity);
        return ok(cart);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to add item to cart.";
        return fail("ADD_TO_CART_FAILED", message);
      }
    }
  });

  const getCartTool = defineTool({
    name: "getCart",
    description: "Get current cart details with itemized totals.",
    input: z.object({}),
    readOnlyHint: true,
    execute: async () => {
      return ok(store.getCart());
    }
  });

  const setShippingAddressTool = defineTool({
    name: "setShippingAddress",
    description: "Set shipping address details used for checkout.",
    input: z.object({
      name: z.string().min(2),
      phone: z.string().min(6),
      address: z.string().min(6)
    }),
    execute: async (input) => {
      const shippingAddress = store.setShippingAddress(input);
      return ok({
        saved: true,
        shippingAddress
      });
    }
  });

  const prepareCheckoutTool = defineSwBackedTool({
    name: "prepareCheckout",
    description:
      "Prepare full checkout summary in service worker (with page fallback) including totals and address.",
    input: z.object({}),
    readOnlyHint: true,
    swCommand: "prepareCheckout",
    executeFallback: async () => {
      try {
        return ok({
          preparedBy: "page-fallback",
          ...store.prepareCheckout()
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to prepare checkout.";
        return fail("CHECKOUT_PREPARATION_FAILED", message);
      }
    }
  });

  const placeOrderTool = defineTool({
    name: "placeOrder",
    description:
      "Place an order after explicit user confirmation. Requires requestUserInteraction.",
    risk: "payment",
    input: z.object({}),
    execute: async (_, client) => {
      let summary;
      try {
        summary = store.prepareCheckout();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to place order.";
        return fail("PLACE_ORDER_BLOCKED", message);
      }

      const confirmed = await client.requestUserInteraction(async () => {
        return store.requestOrderConfirmation(summary);
      });

      if (!confirmed) {
        return fail("ORDER_CANCELLED", "User cancelled the order confirmation flow.");
      }

      const order = store.placeOrder();
      return ok({
        orderId: order.orderId,
        status: order.status,
        total: order.summary.total,
        createdAt: order.createdAt
      });
    }
  });

  const getOrderStatusTool = defineTool({
    name: "getOrderStatus",
    description: "Get order status by order id.",
    input: z.object({
      orderId: z.string().min(1)
    }),
    readOnlyHint: true,
    execute: async (input) => {
      const status = store.getOrderStatus(input.orderId);
      if (!status) {
        return fail("ORDER_NOT_FOUND", "Order not found.", { orderId: input.orderId });
      }

      return ok(status);
    }
  });

  return [
    searchProductsTool,
    getProductTool,
    addToCartTool,
    getCartTool,
    setShippingAddressTool,
    prepareCheckoutTool,
    placeOrderTool,
    getOrderStatusTool
  ] as ModelContextTool[];
}

const SHOP_TOOLS = createShopTools(shopStore);

/**
 * Returns singleton tool instances used by the app.
 */
export function getShopTools(): ModelContextTool[] {
  return SHOP_TOOLS;
}

/**
 * Returns tool metadata for UI inspection pages.
 */
export function getShopToolManifest(): Array<{
  name: string;
  description: string;
  readOnlyHint: boolean;
}> {
  return SHOP_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    readOnlyHint: Boolean(tool.annotations?.readOnlyHint)
  }));
}

/**
 * Executes a tool manually (for in-page diagnostics).
 */
export async function executeToolByName(args: {
  name: string;
  input: unknown;
  client?: ModelContextClient;
}): Promise<unknown | ToolResponse<never>> {
  const tool = SHOP_TOOLS.find((item) => item.name === args.name);
  if (!tool) {
    return fail("TOOL_NOT_FOUND", `Tool "${args.name}" is not registered in demo-shop.`);
  }

  const fallbackClient: ModelContextClient = {
    requestUserInteraction: async (action) => action()
  };

  return tool.execute(args.input, args.client ?? fallbackClient);
}
