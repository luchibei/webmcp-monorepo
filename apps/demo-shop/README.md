# @webmcp/demo-shop

Macro-tool-first ecommerce demo built with Next.js App Router.

Goal: let a browser AI agent complete purchase in 2-4 WebMCP tool calls.

## Features

- Product catalog with mock data (12 products)
- Product detail, cart, checkout, and order status UI
- 8 high-level WebMCP tools registered through `@webmcp/webmcp-react`
- Real in-page confirmation modal for `placeOrder` via `requestUserInteraction`
- `prepareCheckout` runs through Service Worker first (with page fallback)
- `/tools` page for tool manifest + manual tool execution

## Tool list

1. `searchProducts({ q, limit?, filters? })`
2. `getProduct({ id })`
3. `addToCart({ productId, quantity })`
4. `getCart({})`
5. `setShippingAddress({ name, phone, address })`
6. `prepareCheckout({})`
7. `placeOrder({})`
8. `getOrderStatus({ orderId })`

## Run locally

From repo root:

```bash
pnpm install
pnpm --filter @webmcp/demo-shop dev
```

Open `http://localhost:3000`.

## Unit tests

```bash
pnpm --filter @webmcp/demo-shop test
```

## E2E tests (Playwright)

```bash
pnpm --filter @webmcp/demo-shop test:e2e
```

## Manual verification of tools

1. Visit `http://localhost:3000/tools`
2. Check tool manifest list (name + description + `readOnlyHint`)
3. Click `Sync Checkout Context To SW`
4. Run `prepareCheckout` in "Manual Tool Runner" and verify output contains `"preparedBy": "service-worker"`
5. For `placeOrder`, confirm/cancel from modal to verify user interaction handoff
