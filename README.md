# WebMCP Monorepo

Agent Fast Lane for WebMCP.

Build macro-tools once, then let browser agents finish tasks in 2-4 calls instead of 30 fragile UI steps.

## 3-Minute Run Demo

```bash
pnpm i
pnpm dev
```

Then open:

- demo shop (tools + checkout flow): check terminal for `@luchibei/demo-shop` URL (usually `http://localhost:3000`)
- registry (verify WebMCP sites): check terminal for `@luchibei/registry` URL

Tip: `pnpm dev` starts all workspaces in parallel for quick local exploration.

## 5-Minute Integration For Any Website

Install SDK:

```bash
pnpm add @luchibei/webmcp-sdk zod
```

Add a tool:

```ts
import { defineTool, ok, registerToolSafe } from "@luchibei/webmcp-sdk";
import { z } from "zod";

const searchProductsTool = defineTool({
  name: "searchProducts",
  description: "Search products by keyword and optional limit",
  risk: "read",
  input: z.object({
    q: z.string().min(1),
    limit: z.number().int().positive().max(20).optional()
  }),
  execute: async (input) => {
    const items = await searchProducts(input.q, input.limit);
    return ok({ items, totalMatched: items.length });
  }
});

await registerToolSafe(searchProductsTool);
```

That is enough to expose a stable macro-tool through `navigator.modelContext.registerTool`.

## What Is In This Repo

- `packages/webmcp-sdk`: tool definition + safe registration + risk/policy helpers
- `packages/webmcp-react`: React hooks/provider for lifecycle-safe tool registration
- `packages/webmcp-sw-runtime`: service-worker delegation runtime
- `apps/demo-shop`: end-to-end macro-tool ecommerce demo
- `apps/registry`: site directory + verifier + CLI
- `apps/bridge`: run any WebMCP site as an MCP server
- `examples/vanilla-demo`: pure HTML minimal integration

## Media Placeholders

- Demo GIF placeholder: `docs/media/demo-shop.gif`
- Bridge walkthrough screenshot placeholder: `docs/media/bridge-inspector.png`

Use these paths for OSS docs assets when you add real captures.

## Docs

- Security guide: `docs/security.md`
- Quickstart (EN): `docs/quickstart-en.md`
- 快速开始 (中文): `docs/quickstart-cn.md`
- Release process: `docs/release.md`

## Examples

Run vanilla example:

```bash
npx serve examples/vanilla-demo
```
