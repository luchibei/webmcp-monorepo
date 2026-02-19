#!/usr/bin/env node

import { bridgeCliUsage, parseBridgeCliArgs } from "./cli-args.js";
import { createMcpBridgeServer } from "./mcp-server.js";
import { createWebMcpPageRuntime } from "./page-runtime.js";

async function main() {
  let args;

  try {
    args = parseBridgeCliArgs(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to parse CLI arguments.";
    console.error(message);

    if (message !== bridgeCliUsage) {
      console.error("");
      console.error(bridgeCliUsage);
      process.exit(1);
    }

    process.exit(0);
  }

  const runtime = createWebMcpPageRuntime({
    siteUrl: args.siteUrl,
    interactive: args.interactive,
    writeToolPolicy: args.writeToolPolicy
  });

  const mcpServer = createMcpBridgeServer({
    runtime,
    serverName: "webmcp-site-bridge",
    serverVersion: "0.1.0"
  });

  let shuttingDown = false;

  const shutdown = async (reason: string) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.error(`[bridge] shutting down (${reason})`);

    await mcpServer.close().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "unknown error";
      console.error(`[bridge] server close failed: ${message}`);
    });

    await runtime.close().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "unknown error";
      console.error(`[bridge] runtime close failed: ${message}`);
    });
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT").finally(() => process.exit(0));
  });

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM").finally(() => process.exit(0));
  });

  try {
    await runtime.start();
    const discoveredTools = await runtime.waitForInitialTools();

    console.error(`[bridge] site: ${args.siteUrl}`);
    console.error(`[bridge] interactive mode: ${args.interactive ? "enabled" : "disabled"}`);
    console.error(`[bridge] write policy: ${args.writeToolPolicy.mode}`);
    if (args.writeToolPolicy.allowlist.length > 0) {
      console.error(`[bridge] write allowlist: ${args.writeToolPolicy.allowlist.join(", ")}`);
    }
    console.error(`[bridge] initial tools discovered: ${discoveredTools.length}`);

    await mcpServer.start();
    console.error("[bridge] MCP stdio server is ready");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bridge startup failed.";
    console.error(`[bridge] startup failed: ${message}`);
    await shutdown("startup failure");
    process.exit(1);
  }
}

void main();
