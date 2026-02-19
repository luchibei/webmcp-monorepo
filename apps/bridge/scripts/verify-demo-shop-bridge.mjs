import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const DEMO_URL = "http://localhost:3100";
const workspaceRoot = fileURLToPath(new URL("../../..", import.meta.url));

function getPnpmCommand(commandArgs) {
  if (process.platform === "win32") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", "pnpm", ...commandArgs]
    };
  }

  return {
    command: "pnpm",
    args: commandArgs
  };
}

async function waitForServer(url, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, {
        redirect: "manual"
      });

      if (response.status >= 200 && response.status < 500) {
        return;
      }
    } catch {
      await delay(400);
      continue;
    }

    await delay(400);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

function pipeWithPrefix(stream, prefix) {
  if (!stream) {
    return;
  }

  stream.on("data", (chunk) => {
    const text = chunk.toString();
    if (text.trim().length > 0) {
      process.stderr.write(`[${prefix}] ${text}`);
    }
  });
}

async function stopProcessTree(child) {
  if (!child.pid) {
    return;
  }

  if (process.platform === "win32") {
    await new Promise((resolve) => {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore"
      });

      killer.on("exit", () => resolve());
      killer.on("error", () => resolve());
    });

    return;
  }

  child.kill("SIGTERM");
}

async function main() {
  const demoCommand = getPnpmCommand(["--filter", "@webmcp/demo-shop", "dev:playwright"]);

  const demoServer = spawn(demoCommand.command, demoCommand.args, {
    cwd: workspaceRoot,
    stdio: ["ignore", "pipe", "pipe"]
  });

  pipeWithPrefix(demoServer.stdout, "demo-shop");
  pipeWithPrefix(demoServer.stderr, "demo-shop");

  let client;
  let transport;

  try {
    await waitForServer(DEMO_URL, 180_000);

    const bridgeCommand = getPnpmCommand([
      "--filter",
      "@webmcp/bridge",
      "bridge",
      "--url",
      DEMO_URL
    ]);

    transport = new StdioClientTransport({
      command: bridgeCommand.command,
      args: bridgeCommand.args,
      cwd: workspaceRoot,
      stderr: "pipe"
    });

    pipeWithPrefix(transport.stderr, "bridge");

    client = new Client(
      {
        name: "bridge-verifier",
        version: "0.1.0"
      },
      {
        capabilities: {}
      }
    );

    await client.connect(transport);

    const listResult = await client.listTools();
    const searchResult = await client.callTool({
      name: "searchProducts",
      arguments: {
        q: "headphones",
        limit: 3
      }
    });
    const placeOrderResult = await client.callTool({
      name: "placeOrder",
      arguments: {}
    });

    process.stdout.write(
      `${JSON.stringify(
        {
          toolCount: listResult.tools.length,
          searchStructuredContent: searchResult.structuredContent,
          placeOrderIsError: placeOrderResult.isError ?? false,
          placeOrderStructuredContent: placeOrderResult.structuredContent
        },
        null,
        2
      )}\n`
    );
  } finally {
    if (client) {
      await Promise.race([client.close(), delay(2_000)]).catch(() => undefined);
    }

    if (transport) {
      await Promise.race([transport.close(), delay(2_000)]).catch(() => undefined);
    }

    await stopProcessTree(demoServer);
  }

  process.exit(0);
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.message : "verification failed";
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
