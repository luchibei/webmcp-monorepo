import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { verifyWebMcpSite } from "../lib/verify";

const DEMO_SHOP_URL = "http://localhost:3100";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = dirname(currentFilePath);
const workspaceRoot = resolve(currentDir, "../../..");

let demoShopProcess: ChildProcessWithoutNullStreams | null = null;

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.status < 500) {
        return;
      }
    } catch {
      // keep polling
    }

    await new Promise((resolveDelay) => {
      setTimeout(resolveDelay, 1_000);
    });
  }

  throw new Error(`Timed out waiting for server: ${url}`);
}

beforeAll(async () => {
  try {
    await waitForServer(DEMO_SHOP_URL, 2_000);
    return;
  } catch {
    // server not ready, continue and spawn
  }

  const command =
    process.platform === "win32" ? "pnpm --filter @webmcp/demo-shop dev:playwright" : "pnpm";
  const args =
    process.platform === "win32" ? [] : ["--filter", "@webmcp/demo-shop", "dev:playwright"];

  demoShopProcess = spawn(command, args, {
    cwd: workspaceRoot,
    stdio: "pipe",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      CI: "1"
    }
  });

  await waitForServer(DEMO_SHOP_URL, 180_000);
}, 240_000);

afterAll(() => {
  if (!demoShopProcess?.pid) {
    return;
  }

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(demoShopProcess.pid), "/T", "/F"]);
    return;
  }

  demoShopProcess.kill("SIGTERM");
});

describe("webmcp-verify against demo-shop", () => {
  it("captures at least 8 tools with valid schemas", async () => {
    const report = await verifyWebMcpSite(DEMO_SHOP_URL);

    expect(report.toolCount).toBeGreaterThanOrEqual(8);
    expect(report.tools.every((tool) => tool.schemaValid)).toBe(true);
    expect(report.tools.map((tool) => tool.name)).toContain("placeOrder");
  }, 180_000);
});
