# @luchibei/bridge

Node bridge service that turns a WebMCP website into an MCP server for any MCP-compatible AI client.

## Warning (Security Boundary)

- Do **not** point this bridge to real sensitive production websites.
- The bridge runs page code in Chromium and can execute captured tools.
- Write-capable tools are **blocked by default**.
- You must explicitly allow write tools using `--allow-write`:
  - `--allow-write toolA,toolB` (recommended allowlist)
  - `--allow-write` or `--allow-write *` (allow all write tools, dangerous)

## What it does

1. Starts Playwright Chromium and opens `--url <siteUrl>`.
2. Injects a bridge script with `addInitScript` to wrap/stub:
   - `navigator.modelContext.registerTool`
   - `navigator.modelContext.provideContext`
3. Captures tool objects into `window.__webmcpTools` (`Map`).
4. Exposes `window.__webmcpBridge`:
   - `listTools()` => `[{ name, description, inputSchema, readOnlyHint }]`
   - `callTool(name, input)` => runs `tool.execute(input, fakeClient)`
5. Uses `@modelcontextprotocol/sdk` stdio server and maps:
   - MCP `tools/list` -> `window.__webmcpBridge.listTools()`
   - MCP `tools/call` -> `window.__webmcpBridge.callTool()`

## User interaction handling

- `fakeClient.requestUserInteraction` always records an interaction request.
- Default mode: returns error (no MCP-side UI).
- Optional `--interactive` mode:
  - launches headed Chromium
  - uses page `confirm()` dialog for local demo approval

## Run

```bash
pnpm install
pnpm --filter @luchibei/bridge build
pnpm --filter @luchibei/bridge bridge --url http://localhost:3100
```

Useful variants:

```bash
# allowlist specific write tools
pnpm --filter @luchibei/bridge bridge --url http://localhost:3100 --allow-write addToCart,placeOrder

# local interactive demo mode (headed browser)
pnpm --filter @luchibei/bridge bridge --url http://localhost:3100 --interactive
```

## Test with MCP clients

Any MCP client that supports stdio can launch this command as a server program.

Generic stdio server command:

```bash
pnpm --filter @luchibei/bridge bridge --url http://localhost:3100
```

Example with MCP Inspector:

```bash
npx @modelcontextprotocol/inspector pnpm --filter @luchibei/bridge bridge --url http://localhost:3100
```

Then from the MCP client:

- call `tools/list` (should see captured WebMCP tools)
- call `tools/call` with `name` + `arguments`

## Scripts

- `pnpm --filter @luchibei/bridge build`
- `pnpm --filter @luchibei/bridge bridge --url <siteUrl>`
- `pnpm --filter @luchibei/bridge test`
- `pnpm --filter @luchibei/bridge lint`
