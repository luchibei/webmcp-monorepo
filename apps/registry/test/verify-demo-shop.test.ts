import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { verifyWebMcpSite } from "../lib/verify";

const DEMO_SHOP_URL = "http://127.0.0.1:3100";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = dirname(currentFilePath);
const workspaceRoot = resolve(currentDir, "../../..");

let demoShopProcess: ChildProcessWithoutNullStreams | null = null;
let serverReady = false;

function lastOutputChunk(output: string): string {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.slice(-20).join("\n");
}

function createPnpmCommandArgs(pnpmArgs: string[]): {
  command: string;
  args: string[];
  shell: boolean;
} {
  if (process.env.npm_execpath && process.env.npm_execpath.includes("pnpm")) {
    return {
      command: process.execPath,
      args: [process.env.npm_execpath, ...pnpmArgs],
      shell: false
    };
  }

  if (process.platform === "win32") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", "pnpm", ...pnpmArgs],
      shell: false
    };
  }

  return {
    command: "pnpm",
    args: pnpmArgs,
    shell: false
  };
}

function runPnpmSetupOrThrow(pnpmArgs: string[]): void {
  const pnpmCommand = createPnpmCommandArgs(pnpmArgs);
  const result = spawnSync(pnpmCommand.command, pnpmCommand.args, {
    cwd: workspaceRoot,
    shell: pnpmCommand.shell,
    env: {
      ...process.env,
      CI: "1"
    },
    encoding: "utf8"
  });

  if (result.status === 0) {
    return;
  }

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const output = `${stdout}\n${stderr}`.trim();
  const details = output ? `\n\nLast output:\n${lastOutputChunk(output)}` : "";

  throw new Error(
    `pnpm ${pnpmArgs.join(" ")} failed before starting demo-shop (code=${String(result.status)})${details}`
  );
}

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

  runPnpmSetupOrThrow(["--filter", "@webmcp/webmcp-sdk", "build"]);
  runPnpmSetupOrThrow(["--filter", "@webmcp/webmcp-sw-runtime", "build"]);

  const pnpmCommand = createPnpmCommandArgs(["--filter", "@webmcp/demo-shop", "dev:playwright"]);

  demoShopProcess = spawn(pnpmCommand.command, pnpmCommand.args, {
    cwd: workspaceRoot,
    stdio: "pipe",
    shell: pnpmCommand.shell,
    env: {
      ...process.env,
      CI: "1"
    }
  });

  const spawnErrorPromise = new Promise<never>((_, reject) => {
    demoShopProcess?.once("error", (error) => {
      reject(error);
    });
  });

  let combinedOutput = "";

  demoShopProcess.stdout.on("data", (chunk) => {
    combinedOutput += chunk.toString();
  });

  demoShopProcess.stderr.on("data", (chunk) => {
    combinedOutput += chunk.toString();
  });

  const prematureExitPromise = new Promise<never>((_, reject) => {
    demoShopProcess?.once("exit", (code, signal) => {
      if (serverReady) {
        return;
      }

      const logTail = lastOutputChunk(combinedOutput);
      const details = logTail ? `\n\nLast output:\n${logTail}` : "";

      reject(
        new Error(
          `demo-shop process exited before server was ready (code=${String(code)}, signal=${String(signal)})${details}`
        )
      );
    });
  });

  await Promise.race([
    waitForServer(DEMO_SHOP_URL, 180_000),
    spawnErrorPromise,
    prematureExitPromise
  ]);
  serverReady = true;
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
