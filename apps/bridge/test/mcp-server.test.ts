import { describe, expect, it } from "vitest";

import { toMcpCallToolResult, toMcpTool } from "../src/mcp-server";
import type { WebMcpBridgeTool } from "../src/page-runtime";

describe("mcp-server mapping helpers", () => {
  it("maps WebMCP tool metadata to MCP tool format", () => {
    const input: WebMcpBridgeTool = {
      name: "searchProducts",
      description: "Search catalog",
      inputSchema: {
        type: "object",
        properties: {
          q: { type: "string" }
        }
      },
      readOnlyHint: true
    };

    const tool = toMcpTool(input);

    expect(tool.name).toBe("searchProducts");
    expect(tool.annotations?.readOnlyHint).toBe(true);
    expect(tool.inputSchema.type).toBe("object");
  });

  it("maps successful tool response to MCP call_tool result", () => {
    const result = toMcpCallToolResult({
      ok: true,
      data: {
        totalMatched: 3
      }
    });

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent?.totalMatched).toBe(3);
    expect(result.content[0]?.type).toBe("text");
  });

  it("marks failed tool response as MCP error payload", () => {
    const result = toMcpCallToolResult({
      ok: false,
      error: {
        code: "WRITE_TOOL_BLOCKED",
        message: "blocked"
      }
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent?.code).toBe("WRITE_TOOL_BLOCKED");
  });

  it("wraps primitive payload into structuredContent object", () => {
    const result = toMcpCallToolResult({
      ok: true,
      data: 42
    });

    expect(result.structuredContent?.value).toBe(42);
  });
});
