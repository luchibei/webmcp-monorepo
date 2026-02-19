# @webmcp/registry

WebMCP site directory + verification CLI.

## Features

- Submit a site URL, name, and optional description
- Store registry data locally in `data/sites.json`
- List sites with verification status, tool count, and latest verify time
- Site detail page with tool inventory (`name`, `description`, `readOnlyHint`, schema summary)
- API endpoint `/api/verify?url=...`
- CLI command `webmcp-verify <url>`

## Start registry app

```bash
pnpm install
pnpm --filter @webmcp/registry dev
```

Open: `http://localhost:3000`

## Run CLI verify against demo-shop

Terminal 1:

```bash
pnpm --filter @webmcp/demo-shop dev:playwright
```

Terminal 2:

```bash
pnpm --filter @webmcp/registry build:cli
pnpm --filter @webmcp/registry webmcp-verify http://localhost:3100
```

## API verify

```bash
curl "http://localhost:3000/api/verify?url=http://localhost:3100"
```

## Example report

```json
{
  "url": "http://localhost:3100/",
  "toolCount": 8,
  "tools": [
    {
      "name": "searchProducts",
      "description": "Search products by query, optional limit, and structured filters.",
      "readOnlyHint": true,
      "risk": "read",
      "schemaValid": true,
      "schemaSummary": "type=object; props=q,limit,filters"
    }
  ],
  "warnings": [],
  "errors": [],
  "capturedCalls": [
    {
      "method": "registerTool",
      "timestamp": 1730000000000
    }
  ],
  "verifiedAt": "2026-02-19T00:00:00.000Z"
}
```
