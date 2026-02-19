# WebMCP Security Guide

本文件描述 WebMCP monorepo 的安全边界、风险分级与默认策略。

## 1. 风险分级约定（上层约定）

在 `@luchibei/webmcp-sdk` 中，工具可声明：

- `risk: "read"`
- `risk: "write"`
- `risk: "payment"`

该约定不会改变 WebMCP 规范字段，最终仍映射到：

- `annotations.readOnlyHint = true` 仅用于 `risk: "read"`
- `annotations.readOnlyHint = false` 用于 `risk: "write" | "payment"`

此外，若工具执行结果为 `ToolResponse`，SDK 会附带：

- `response.metadata.risk`

用于审计与策略判断（可选元数据，不影响规范兼容性）。

## 2. 工具注册策略

SDK 提供 `createToolPolicy(...)`，并可注入到 `registerToolSafe/registerToolsSafe`：

- `defaultDenyWrite: true` 时，默认拒绝非 read 工具注册
- `requireConfirmationForRisk: ["payment"]` 可阻止高风险工具在未确认场景注册

建议：

- 生产环境默认启用拒绝写入策略
- payment 工具仅在明确业务流程和人工确认链路下注册

## 3. Bridge 安全边界

`apps/bridge` 默认拒绝 `readOnlyHint !== true` 的工具调用：

- 仅 `--allow-write`（或 allowlist）时放行
- `requestUserInteraction` 默认返回错误并记录请求
- 仅 `--interactive` 本地演示模式允许浏览器确认弹窗

## 4. Registry 风险提示

`apps/registry` 验证报告新增风险推断：

- `readOnlyHint=true -> risk=read`
- 否则 `risk=unknown/write`

并在 `warnings` 输出潜在高风险工具列表，便于目录站点进行准入审核。

## 5. demo-shop 约束

- `placeOrder` 标记为 `risk: "payment"`
- 下单必须经过 `requestUserInteraction` + 页面确认对话框

## 6. 不要用于敏感真实站点

Bridge/Verifier 会在浏览器里执行页面代码并可触发工具：

- 不要直接指向真实生产支付站点
- 不要在未隔离环境下放开 `--allow-write`
- 不要在工具返回中暴露任何密钥、令牌、PII
