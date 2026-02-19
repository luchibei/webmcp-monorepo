# @luchibei/webmcp-sdk

WebMCP SDK for defining and registering robust tools in the browser.

`@luchibei/webmcp-sdk` wraps the WebMCP APIs with:

- Zod-first tool definitions
- automatic JSON Schema generation (`zod-to-json-schema`)
- safe runtime wrappers (no-op when WebMCP is unavailable)
- optional risk labels (`read` / `write` / `payment`)
- tool registration policy checks (`createToolPolicy`)
- consistent error helpers (`ok` / `fail`)

---

## What is WebMCP?

WebMCP allows websites to expose high-level tools to browser AI agents through `navigator.modelContext`.

This SDK targets these API names/fields:

- `navigator.modelContext.provideContext({ tools })`
- `navigator.modelContext.registerTool(tool)`
- `navigator.modelContext.clearContext()`
- `navigator.modelContext.unregisterTool(name)`
- `tool = { name, description, inputSchema, execute(input, client), annotations? }`

The WebIDL may describe `undefined` returns, but real implementations can be sync/async.
This SDK treats all of them as `void | Promise<void>` and always awaits internally.

---

## 5-minute setup

### 1) Install

```bash
pnpm add @luchibei/webmcp-sdk zod
```

### 2) Define a tool

```ts
import { defineTool, ok } from "@luchibei/webmcp-sdk";
import { z } from "zod";

export const searchProductsTool = defineTool({
  name: "searchProducts",
  description: "Search products by keyword and optional price range",
  risk: "read",
  input: z.object({
    query: z.string().min(1),
    maxPrice: z.number().positive().optional()
  }),
  readOnlyHint: true,
  execute: async (input) => {
    const items = await searchProducts(input.query, input.maxPrice);
    return ok(items);
  }
});
```

### 3) Register safely

```ts
import { registerToolSafe } from "@luchibei/webmcp-sdk";

const handle = await registerToolSafe(searchProductsTool);

// later
await handle.unregister();
```

### 4) Register multiple tools

```ts
import { registerToolsSafe } from "@luchibei/webmcp-sdk";

const { unregisterAll } = await registerToolsSafe([searchProductsTool]);

// later
await unregisterAll();
```

### 5) Apply a registration policy

```ts
import { createToolPolicy, registerToolsSafe } from "@luchibei/webmcp-sdk";

const policy = createToolPolicy({
  defaultDenyWrite: false,
  requireConfirmationForRisk: ["payment"]
});

await registerToolsSafe([searchProductsTool], { policy });
```

---

## API summary

- `defineTool(options)`
- `ok(data)`
- `fail(code, message, details?)`
- `getModelContext()`
- `isWebMcpSupported()`
- `provideContextSafe({ tools })`
- `clearContextSafe()`
- `registerToolSafe(tool, { policy? })`
- `unregisterToolSafe(name)`
- `registerToolsSafe(tools, { policy? })`
- `createToolPolicy(options)`

### ToolResponse

```ts
type ToolResponse<T> =
  | { ok: true; data: T; metadata?: { risk?: "read" | "write" | "payment" } }
  | {
      ok: false;
      error: { code: string; message: string; details?: unknown };
      metadata?: { risk?: "read" | "write" | "payment" };
    };
```

`defineTool` always validates input and returns a standardized failure response for validation/runtime errors.
For successful execution, you can return your own payload or use `ok(data)`.

---

## Security best practices

1. Set `readOnlyHint: true` for read-only tools.
   - or use `risk: "read"` (auto-maps to `annotations.readOnlyHint = true`)
2. Use explicit user confirmation before sensitive actions (checkout, payment, profile update).
   - use `risk: "payment"` for payment tools and enforce policy at registration time
3. Keep tool inputs high-level and validated (avoid low-level click/selector operations).
4. Do not expose secrets in tool output.

For sensitive actions, request user interaction in the execution flow via WebMCP client capabilities:

```ts
await client.requestUserInteraction(async () => {
  // ask user confirmation in UI, then proceed
});
```

---

## 中文说明（简版）

`@luchibei/webmcp-sdk` 用于把网站能力封装成 WebMCP 工具，核心特性：

- 用 Zod 定义输入，自动生成 `inputSchema`
- 自动校验输入 + 统一错误结构
- `registerTool/provideContext/clearContext/unregisterTool` 全部有安全封装
- WebMCP 不可用时自动 no-op，不会导致页面崩溃

建议：

- 只读工具加 `readOnlyHint: true`
- 下单/支付等敏感操作必须走确认步骤（`client.requestUserInteraction`）

---

## FAQ

### Q: Browser does not support WebMCP. What should I do?

Use the safe wrappers:

- `registerToolSafe`
- `registerToolsSafe`
- `provideContextSafe`
- `clearContextSafe`

They no-op when WebMCP is unavailable, so your app still works.

### Q: Should I expose write/payment tools by default?

No. Prefer explicit policies:

```ts
const policy = createToolPolicy({
  defaultDenyWrite: true,
  requireConfirmationForRisk: ["payment"]
});
```

### Q: Do risk labels change WebMCP spec fields?

No. `risk` is an upper-layer convention.
Spec compatibility remains through `annotations.readOnlyHint`.
