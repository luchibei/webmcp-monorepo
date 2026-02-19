# @webmcp/webmcp-sw-runtime

Service Worker runtime for WebMCP tools.

This package supports two execution modes:

1. **Mode 1 (future/experimental)**: direct registration in SW if `self.agent`/`self.modelContext`-like APIs are available.
2. **Mode 2 (current default)**: tools are registered in page, but execution is delegated to SW through `postMessage`.

## Install

```bash
pnpm add @webmcp/webmcp-sw-runtime @webmcp/webmcp-sdk zod
```

## API List

- `createSwToolBridge({ serviceWorkerPath, timeoutMs? })`
- `defineSwBackedTool({ name, description, input, readOnlyHint?, swCommand?, executeFallback? })`
- `createSwRouter(handlers, options?)`
- protocol constants and types:
  - `WEBMCP_TOOL_CALL`
  - `WEBMCP_TOOL_RESULT`

---

## Typical Usage

### 1) Page side: bridge + SW-backed tool

```ts
import { createSwToolBridge, defineSwBackedTool } from "@webmcp/webmcp-sw-runtime";
import { z } from "zod";

createSwToolBridge({
  serviceWorkerPath: "/webmcp-shop-sw.js",
  timeoutMs: 3000
});

const prepareCheckoutTool = defineSwBackedTool({
  name: "prepareCheckout",
  description: "Prepare checkout in service worker",
  input: z.object({}),
  readOnlyHint: true,
  swCommand: "prepareCheckout",
  executeFallback: async () => ({ preparedBy: "page-fallback" })
});
```

### 2) SW side: router

```ts
import { createSwRouter } from "@webmcp/webmcp-sw-runtime";
import { fail } from "@webmcp/webmcp-sdk";
import { z } from "zod";

let checkoutContext: {
  cart: { itemCount: number; subtotal: number };
  shippingAddress: unknown;
} | null = null;

createSwRouter({
  __syncCheckoutState: {
    input: z.object({
      cart: z.object({ itemCount: z.number(), subtotal: z.number() }),
      shippingAddress: z.any().nullable()
    }),
    execute: async (input) => {
      checkoutContext = input;
      return { synced: true };
    }
  },
  prepareCheckout: {
    input: z.object({}),
    execute: async () => {
      if (!checkoutContext) {
        return fail("CHECKOUT_CONTEXT_MISSING", "Checkout state has not been synced yet.");
      }

      return { preparedBy: "service-worker", ...checkoutContext.cart };
    }
  }
});

// optional: mode-1 direct registration when self.agent/self.modelContext exists
// const direct = await router.registerDirectTools([toolA, toolB], "provideContext");
```

### 3) Register page tools normally

`defineSwBackedTool(...)` returns a normal WebMCP tool shape, so you can register with the SDK/react wrappers as usual.

## Sensitive actions guideline

For payment/order actions:

- SW can do precomputation and risk checks.
- Final confirmation should stay on page with `client.requestUserInteraction(async () => { ... })`.

---

## FAQ

### Q: What if WebMCP itself is not available?

SW runtime can still run, but no tools are exposed until WebMCP registration happens on page side.
Pair with SDK safe wrappers so unsupported browsers fail gracefully.

### Q: What if Service Worker is unavailable or not ready?

`defineSwBackedTool` uses fallback behavior if provided; otherwise returns a structured error (`SW_UNAVAILABLE` / `SW_NOT_READY` / timeout).

### Q: Can I execute payment directly in SW?

Not recommended. Keep final write/payment confirmation on page UI via `requestUserInteraction`.
