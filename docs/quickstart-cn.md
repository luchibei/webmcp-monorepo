# WebMCP 快速开始（中文）

本指南帮助你从 0 到注册第一个 WebMCP 工具。

## 0）前置条件

- Node.js `>=20`
- 站点运行在安全上下文（HTTPS 或 localhost）

## 1）安装

```bash
pnpm add @luchibei/webmcp-sdk zod
```

## 2）定义第一个工具

```ts
import { defineTool, ok } from "@luchibei/webmcp-sdk";
import { z } from "zod";

export const getPageTitleTool = defineTool({
  name: "getPageTitle",
  description: "获取当前页面标题",
  risk: "read",
  input: z.object({}),
  execute: async () => {
    return ok({
      title: document.title
    });
  }
});
```

## 3）安全注册

```ts
import { isWebMcpSupported, registerToolSafe } from "@luchibei/webmcp-sdk";

if (isWebMcpSupported()) {
  await registerToolSafe(getPageTitleTool);
}
```

当浏览器不支持 WebMCP 时，safe wrapper 会自动 no-op，不影响页面主流程。

## 4）再加一个“宏工具”

```ts
import { defineTool, ok } from "@luchibei/webmcp-sdk";
import { z } from "zod";

const searchFlightsTool = defineTool({
  name: "searchFlights",
  description: "按出发地、目的地和日期查询航班",
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

## 宏工具设计原则（重点）

目标是把用户目标从 **30 步 UI 操作压缩成 2-4 次 tool calls**。

- 不推荐：点按钮、填输入框、开弹窗、选项、确认等底层动作
- 推荐：`searchFlights`、`prepareCheckout`、`placeOrder`、`getOrderStatus`

宏工具应具备：

- 面向业务意图（不是面向 DOM 操作）
- 严格输入校验
- 结构化输出，便于下一次调用串联

## `requestUserInteraction` 确认模式建议

对 `write` / `payment` 风险工具，必须做显式确认。

建议流程：

1. 先计算摘要（金额、目标对象、副作用）。
2. 调用 `client.requestUserInteraction(async () => { ... })`。
3. UI 给用户明确确认/取消。
4. 只有确认后才执行副作用。

示例：

```ts
const placeOrderTool = defineTool({
  name: "placeOrder",
  description: "用户确认后提交支付订单",
  risk: "payment",
  input: z.object({ cartId: z.string() }),
  execute: async (input, client) => {
    const summary = await buildOrderSummary(input.cartId);

    const confirmed = await client.requestUserInteraction(async () => {
      return showPaymentConfirmationDialog(summary);
    });

    if (!confirmed) {
      return { ok: false, error: { code: "ORDER_CANCELLED", message: "用户取消" } };
    }

    return ok(await submitOrder(input.cartId));
  }
});
```

## 下一步

- React 集成：`packages/webmcp-react/README.md`
- Service Worker 运行时：`packages/webmcp-sw-runtime/README.md`
- 把站点桥接为 MCP Server：`apps/bridge/README.md`
