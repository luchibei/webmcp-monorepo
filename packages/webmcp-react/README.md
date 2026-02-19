# @webmcp/webmcp-react

React integration for WebMCP tool lifecycle management.

Use this package when you want registration/unregistration behavior tied to React lifecycle and route boundaries.

## Install

```bash
pnpm add @webmcp/webmcp-react @webmcp/webmcp-sdk zod
```

## API List

- `WebMcpProvider`
  - props: `tools`, `strategy?: "registerTool" | "provideContext"`
- `useWebMcpTool(tool, enabled?)`
  - returns tool registration status for one tool
- `useWebMcpTools(tools, enabled?)`
  - returns registration status for multiple tools
- `WebMcpRouteBoundary` (from `@webmcp/webmcp-react/next`)
  - props: `toolsFactory(pathname)`

---

## Typical Usage

### 1) App-level registration (`WebMcpProvider`)

```tsx
"use client";

import { WebMcpProvider } from "@webmcp/webmcp-react";

import { getShopTools } from "./tools";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <WebMcpProvider tools={getShopTools()} strategy="registerTool">
      {children}
    </WebMcpProvider>
  );
}
```

### 2) Component-level tool (`useWebMcpTool`)

```ts
import { defineTool, ok } from "@webmcp/webmcp-sdk";
import { useWebMcpTool } from "@webmcp/webmcp-react";
import { z } from "zod";

const viewCartTool = defineTool({
  name: "viewCart",
  description: "Get current cart summary",
  input: z.object({}),
  readOnlyHint: true,
  execute: async () => ok({ totalItems: 2, totalPrice: 199 })
});

export function CartWidget() {
  const { registered } = useWebMcpTool(viewCartTool, true);

  return <div>WebMCP tool status: {registered ? "registered" : "idle"}</div>;
}
```

### 3) Next.js route-level tools (`WebMcpRouteBoundary`)

```tsx
"use client";

import { defineTool } from "@webmcp/webmcp-sdk";
import { WebMcpRouteBoundary } from "@webmcp/webmcp-react/next";
import { z } from "zod";

const listOrdersTool = defineTool({
  name: "listOrders",
  description: "List recent orders",
  input: z.object({ limit: z.number().int().positive().max(20).optional() }),
  readOnlyHint: true,
  execute: async () => ({ ok: true, orders: [] })
});

const placeOrderTool = defineTool({
  name: "placeOrder",
  description: "Submit order with confirmation",
  input: z.object({ cartId: z.string() }),
  execute: async (input, client) =>
    client.requestUserInteraction(async () => {
      return { ok: true, orderId: `order-${input.cartId}` };
    })
});

export function RouteToolsBoundary({ children }: { children: React.ReactNode }) {
  return (
    <WebMcpRouteBoundary
      toolsFactory={(pathname) => {
        if (pathname.startsWith("/checkout")) {
          return [listOrdersTool, placeOrderTool];
        }

        return [listOrdersTool];
      }}
    >
      {children}
    </WebMcpRouteBoundary>
  );
}
```

`WebMcpRouteBoundary` listens to `usePathname()` and re-registers tools when route changes, preventing stale tool leakage from previous routes.

---

## Registration strategies

`WebMcpProvider` supports:

- `strategy="registerTool"` (default): component-friendly incremental registration
- `strategy="provideContext"`: clears old context and provides a fresh tool set

Both strategies use safe wrappers internally and degrade silently when WebMCP is unavailable.

---

## FAQ

### Q: What if the browser does not support WebMCP?

No crash and no hard failure. Hooks/provider degrade to no-op using SDK safe wrappers.

### Q: Should I use `registerTool` or `provideContext` strategy?

- Use `registerTool` for componentized apps where tools appear/disappear with UI state.
- Use `provideContext` when you want one authoritative tool snapshot for the subtree.

### Q: Can I expose payment tools from route boundaries?

Yes, but pair them with explicit `client.requestUserInteraction` confirmation flows and policy-based registration in production.
