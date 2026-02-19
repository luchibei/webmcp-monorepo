# WebMCP Quickstart (EN)

This guide gets you from zero to your first registered WebMCP tool.

## 0) Prerequisites

- Node.js `>=20`
- A website/app running in a secure context (HTTPS or localhost)

## 1) Install

```bash
pnpm add @webmcp/webmcp-sdk zod
```

## 2) Define your first tool

```ts
import { defineTool, ok } from "@webmcp/webmcp-sdk";
import { z } from "zod";

export const getPageTitleTool = defineTool({
  name: "getPageTitle",
  description: "Return current page title",
  risk: "read",
  input: z.object({}),
  execute: async () => {
    return ok({
      title: document.title
    });
  }
});
```

## 3) Register safely

```ts
import { isWebMcpSupported, registerToolSafe } from "@webmcp/webmcp-sdk";

if (isWebMcpSupported()) {
  await registerToolSafe(getPageTitleTool);
}
```

If WebMCP is unavailable, safe wrappers no-op and your page still works.

## 4) Add one useful macro tool

```ts
import { defineTool, ok } from "@webmcp/webmcp-sdk";
import { z } from "zod";

const searchFlightsTool = defineTool({
  name: "searchFlights",
  description: "Find flights by origin, destination, and date",
  risk: "read",
  input: z.object({
    from: z.string().min(3),
    to: z.string().min(3),
    date: z.string().min(8)
  }),
  execute: async (input) => {
    const rows = await mockFlightSearch(input);
    return ok({ results: rows, total: rows.length });
  }
});
```

## Macro-Tool Design Principle (Important)

Design tools so agents complete user goals in **2-4 calls**, not 30 UI operations.

- Bad: click button, type text, open popup, select item, confirm, etc.
- Good: `searchFlights`, `prepareCheckout`, `placeOrder`, `getOrderStatus`

A good macro tool has:

- high-level business intent
- validated structured input
- structured output that can chain into next tool call

## `requestUserInteraction` Confirmation Pattern

For sensitive operations (`write`, `payment`), require explicit user confirmation.

Recommended pattern:

1. Tool computes a summary first (amount, destination, side effects).
2. Tool calls `client.requestUserInteraction(async () => { ... })`.
3. UI shows clear approve/reject action.
4. Only then execute side effects.

Example shape:

```ts
const placeOrderTool = defineTool({
  name: "placeOrder",
  description: "Submit paid order after explicit confirmation",
  risk: "payment",
  input: z.object({ cartId: z.string() }),
  execute: async (input, client) => {
    const summary = await buildOrderSummary(input.cartId);

    const confirmed = await client.requestUserInteraction(async () => {
      return showPaymentConfirmationDialog(summary);
    });

    if (!confirmed) {
      return { ok: false, error: { code: "ORDER_CANCELLED", message: "User cancelled" } };
    }

    return ok(await submitOrder(input.cartId));
  }
});
```

## Next Steps

- React apps: `packages/webmcp-react/README.md`
- SW delegation: `packages/webmcp-sw-runtime/README.md`
- Expose site as MCP server: `apps/bridge/README.md`
