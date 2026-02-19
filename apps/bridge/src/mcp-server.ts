import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
  type Tool
} from "@modelcontextprotocol/sdk/types.js";

import type { WebMcpBridgeTool, WebMcpPageRuntime, WebMcpToolCallResult } from "./page-runtime.js";

export interface McpBridgeServerOptions {
  runtime: WebMcpPageRuntime;
  serverName?: string;
  serverVersion?: string;
}

export interface McpBridgeServer {
  start(): Promise<void>;
  close(): Promise<void>;
}

function asObjectRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function toContentText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "[unserializable result]";
  }
}

function toMcpInputSchema(inputSchema: Record<string, unknown>): Tool["inputSchema"] {
  const schemaRecord = asObjectRecord(inputSchema);
  if (!schemaRecord) {
    return {
      type: "object",
      properties: {}
    };
  }

  if (schemaRecord.type === "object") {
    return schemaRecord as Tool["inputSchema"];
  }

  return {
    ...schemaRecord,
    type: "object",
    properties:
      schemaRecord.properties && typeof schemaRecord.properties === "object"
        ? (schemaRecord.properties as Record<string, object>)
        : {}
  } as Tool["inputSchema"];
}

/**
 * Converts captured WebMCP tool metadata into MCP tool metadata.
 */
export function toMcpTool(tool: WebMcpBridgeTool): Tool {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: toMcpInputSchema(tool.inputSchema),
    annotations: {
      readOnlyHint: tool.readOnlyHint
    }
  };
}

/**
 * Converts a WebMCP tool call result to MCP call_tool payload.
 */
export function toMcpCallToolResult(result: WebMcpToolCallResult): CallToolResult {
  const payload = result.ok ? result.data : result.error;
  const structured = asObjectRecord(payload) ?? { value: payload };

  return {
    content: [
      {
        type: "text",
        text: toContentText(payload)
      }
    ],
    structuredContent: structured,
    ...(!result.ok ? { isError: true } : {})
  };
}

class StdioMcpBridgeServer implements McpBridgeServer {
  private readonly server: Server;
  private started = false;

  public constructor(private readonly options: McpBridgeServerOptions) {
    this.server = new Server(
      {
        name: options.serverName ?? "webmcp-bridge",
        version: options.serverVersion ?? "0.1.0"
      },
      {
        capabilities: {
          tools: {
            listChanged: true
          }
        }
      }
    );

    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = await this.options.runtime.listTools();
      return {
        tools: tools.map(toMcpTool)
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const result = await this.options.runtime.callTool(
        request.params.name,
        request.params.arguments ?? {}
      );

      return toMcpCallToolResult(result);
    });
  }

  public async start(): Promise<void> {
    if (this.started) {
      return;
    }

    this.started = true;
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  public async close(): Promise<void> {
    if (!this.started) {
      return;
    }

    this.started = false;
    await this.server.close();
  }
}

/**
 * Creates an MCP stdio server that proxies WebMCP tools from the browser page runtime.
 */
export function createMcpBridgeServer(options: McpBridgeServerOptions): McpBridgeServer {
  return new StdioMcpBridgeServer(options);
}
