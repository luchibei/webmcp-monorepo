import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

import type { ToolResponse } from "@webmcp/webmcp-sdk";

import type { WriteToolPolicy } from "./cli-args.js";

export interface WebMcpBridgeTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  readOnlyHint: boolean;
}

export type WebMcpToolCallResult = ToolResponse<unknown>;

export interface CreateWebMcpPageRuntimeOptions {
  siteUrl: string;
  interactive: boolean;
  writeToolPolicy: WriteToolPolicy;
  navigationTimeoutMs?: number;
  startupToolWaitMs?: number;
}

export interface WebMcpPageRuntime {
  start(): Promise<void>;
  waitForInitialTools(): Promise<WebMcpBridgeTool[]>;
  listTools(): Promise<WebMcpBridgeTool[]>;
  callTool(name: string, input: unknown): Promise<WebMcpToolCallResult>;
  getInteractionRequests(): Promise<Array<Record<string, unknown>>>;
  close(): Promise<void>;
}

interface InjectedBridgeOptions {
  interactive: boolean;
  allowWriteMode: WriteToolPolicy["mode"];
  allowWriteTools: string[];
}

const INJECTED_BRIDGE_SCRIPT = String.raw`(() => {
  const globalObj = window;

  const state =
    globalObj.__webmcpBridgeState && typeof globalObj.__webmcpBridgeState === "object"
      ? globalObj.__webmcpBridgeState
      : {
          tools: new Map(),
          interactionRequests: [],
          options: {
            interactive: false,
            allowWriteMode: "none",
            allowWriteTools: []
          }
        };

  globalObj.__webmcpBridgeState = state;
  globalObj.__webmcpTools = state.tools;

  const fail = (code, message, details) => {
    const error = details === undefined ? { code, message } : { code, message, details };
    return {
      ok: false,
      error
    };
  };

  const toErrorMessage = (error) => {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (typeof error === "string") {
      return error;
    }

    return "Tool execution failed.";
  };

  const toErrorDetails = (error) => {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }

    return error;
  };

  const normalizeToolResponse = (value) => {
    if (value && typeof value === "object" && "ok" in value) {
      if (value.ok === true || value.ok === false) {
        return value;
      }
    }

    return {
      ok: true,
      data: value
    };
  };

  const normalizeInputSchema = (inputSchema) => {
    if (!inputSchema || typeof inputSchema !== "object" || Array.isArray(inputSchema)) {
      return {
        type: "object",
        properties: {}
      };
    }

    return inputSchema;
  };

  const toToolSummary = (tool) => {
    if (!tool || typeof tool !== "object") {
      return null;
    }

    if (typeof tool.name !== "string" || tool.name.trim() === "") {
      return null;
    }

    return {
      name: tool.name.trim(),
      description: typeof tool.description === "string" ? tool.description : "",
      inputSchema: normalizeInputSchema(tool.inputSchema),
      readOnlyHint: Boolean(tool.annotations && tool.annotations.readOnlyHint === true)
    };
  };

  const recordTool = (tool) => {
    const summary = toToolSummary(tool);
    if (!summary) {
      return;
    }

    state.tools.set(summary.name, tool);
  };

  const listTools = () => {
    const result = [];

    for (const tool of state.tools.values()) {
      const summary = toToolSummary(tool);
      if (summary) {
        result.push(summary);
      }
    }

    return result;
  };

  const canInvokeWriteTool = (toolName) => {
    if (state.options.allowWriteMode === "all") {
      return true;
    }

    if (state.options.allowWriteMode === "allowlist") {
      return (
        Array.isArray(state.options.allowWriteTools) &&
        state.options.allowWriteTools.includes(toolName)
      );
    }

    return false;
  };

  const setOptions = (options) => {
    if (!options || typeof options !== "object") {
      return;
    }

    state.options.interactive = Boolean(options.interactive);

    if (
      options.allowWriteMode === "none" ||
      options.allowWriteMode === "all" ||
      options.allowWriteMode === "allowlist"
    ) {
      state.options.allowWriteMode = options.allowWriteMode;
    } else {
      state.options.allowWriteMode = "none";
    }

    state.options.allowWriteTools = Array.isArray(options.allowWriteTools)
      ? options.allowWriteTools
          .filter((entry) => typeof entry === "string")
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0)
      : [];
  };

  const callTool = async (name, input) => {
    if (typeof name !== "string" || name.trim() === "") {
      return fail("INVALID_TOOL_NAME", "Tool name must be a non-empty string.");
    }

    const normalizedName = name.trim();
    const tool = state.tools.get(normalizedName);

    if (!tool) {
      return fail("TOOL_NOT_FOUND", "Requested tool was not captured from this site.", {
        name: normalizedName
      });
    }

    if (typeof tool.execute !== "function") {
      return fail("INVALID_TOOL", "Captured tool does not expose execute(input, client).", {
        name: normalizedName
      });
    }

    const readOnlyHint = Boolean(tool.annotations && tool.annotations.readOnlyHint === true);

    if (!readOnlyHint && !canInvokeWriteTool(normalizedName)) {
      return fail(
        "WRITE_TOOL_BLOCKED",
        "Non-readOnly tool blocked by bridge policy. Use --allow-write to allow this tool.",
        {
          name: normalizedName,
          policy: state.options.allowWriteMode,
          allowlist: state.options.allowWriteTools
        }
      );
    }

    const fakeClient = {
      requestUserInteraction: async (action) => {
        const interaction = {
          toolName: normalizedName,
          timestamp: Date.now(),
          interactive: state.options.interactive,
          status: "requested"
        };

        state.interactionRequests.push(interaction);

        if (!state.options.interactive) {
          interaction.status = "blocked";
          throw new Error(
            "Tool requested user interaction. Restart bridge with --interactive for local confirmation."
          );
        }

        const promptText =
          "Tool \"" + normalizedName + "\" requested user interaction. Continue?";
        const confirmed =
          typeof globalObj.confirm === "function" ? globalObj.confirm(promptText) : false;

        if (!confirmed) {
          interaction.status = "denied";
          throw new Error("User denied requested interaction.");
        }

        interaction.status = "approved";

        if (typeof action !== "function") {
          throw new Error("Invalid interaction callback provided by tool.");
        }

        return await action();
      }
    };

    try {
      const result = await tool.execute(input, fakeClient);
      return normalizeToolResponse(result);
    } catch (error) {
      return fail("TOOL_EXECUTION_ERROR", toErrorMessage(error), {
        cause: toErrorDetails(error)
      });
    }
  };

  const bridgeApi = {
    setOptions,
    listTools,
    callTool,
    getInteractionRequests() {
      return state.interactionRequests.slice();
    },
    clearInteractionRequests() {
      state.interactionRequests.length = 0;
    }
  };

  globalObj.__webmcpBridge = bridgeApi;

  let underlyingModelContext = navigator.modelContext;

  const wrapper = {
    provideContext(options) {
      if (options && Array.isArray(options.tools)) {
        state.tools.clear();
        options.tools.forEach((tool) => recordTool(tool));
      }

      if (
        underlyingModelContext &&
        underlyingModelContext !== wrapper &&
        typeof underlyingModelContext.provideContext === "function"
      ) {
        return underlyingModelContext.provideContext(options);
      }

      return undefined;
    },
    registerTool(tool) {
      recordTool(tool);

      if (
        underlyingModelContext &&
        underlyingModelContext !== wrapper &&
        typeof underlyingModelContext.registerTool === "function"
      ) {
        return underlyingModelContext.registerTool(tool);
      }

      return undefined;
    },
    clearContext() {
      state.tools.clear();

      if (
        underlyingModelContext &&
        underlyingModelContext !== wrapper &&
        typeof underlyingModelContext.clearContext === "function"
      ) {
        return underlyingModelContext.clearContext();
      }

      return undefined;
    },
    unregisterTool(name) {
      if (typeof name === "string") {
        state.tools.delete(name);
      }

      if (
        underlyingModelContext &&
        underlyingModelContext !== wrapper &&
        typeof underlyingModelContext.unregisterTool === "function"
      ) {
        return underlyingModelContext.unregisterTool(name);
      }

      return undefined;
    }
  };

  try {
    Object.defineProperty(navigator, "modelContext", {
      configurable: true,
      get() {
        return wrapper;
      },
      set(value) {
        underlyingModelContext = value;
      }
    });
  } catch {
    if (underlyingModelContext && typeof underlyingModelContext === "object") {
      const target = underlyingModelContext;

      const originalProvideContext =
        typeof target.provideContext === "function" ? target.provideContext.bind(target) : undefined;
      const originalRegisterTool =
        typeof target.registerTool === "function" ? target.registerTool.bind(target) : undefined;
      const originalClearContext =
        typeof target.clearContext === "function" ? target.clearContext.bind(target) : undefined;
      const originalUnregisterTool =
        typeof target.unregisterTool === "function" ? target.unregisterTool.bind(target) : undefined;

      target.provideContext = (options) => {
        if (options && Array.isArray(options.tools)) {
          state.tools.clear();
          options.tools.forEach((tool) => recordTool(tool));
        }

        return originalProvideContext ? originalProvideContext(options) : undefined;
      };

      target.registerTool = (tool) => {
        recordTool(tool);
        return originalRegisterTool ? originalRegisterTool(tool) : undefined;
      };

      target.clearContext = () => {
        state.tools.clear();
        return originalClearContext ? originalClearContext() : undefined;
      };

      target.unregisterTool = (name) => {
        if (typeof name === "string") {
          state.tools.delete(name);
        }

        return originalUnregisterTool ? originalUnregisterTool(name) : undefined;
      };
    }
  }
})();`;

function toErrorResult(code: string, message: string, details?: unknown): WebMcpToolCallResult {
  return {
    ok: false,
    error: details === undefined ? { code, message } : { code, message, details }
  };
}

function normalizeTool(tool: unknown): WebMcpBridgeTool | null {
  if (!tool || typeof tool !== "object") {
    return null;
  }

  const candidate = tool as Partial<WebMcpBridgeTool>;

  if (typeof candidate.name !== "string" || candidate.name.trim() === "") {
    return null;
  }

  const inputSchema =
    candidate.inputSchema &&
    typeof candidate.inputSchema === "object" &&
    !Array.isArray(candidate.inputSchema)
      ? (candidate.inputSchema as Record<string, unknown>)
      : {
          type: "object",
          properties: {}
        };

  return {
    name: candidate.name,
    description: typeof candidate.description === "string" ? candidate.description : "",
    inputSchema,
    readOnlyHint: Boolean(candidate.readOnlyHint)
  };
}

function normalizeToolCallResult(value: unknown): WebMcpToolCallResult {
  if (value && typeof value === "object") {
    const maybeResponse = value as Partial<WebMcpToolCallResult> & {
      error?: { code?: unknown; message?: unknown };
    };

    if (maybeResponse.ok === true && "data" in maybeResponse) {
      return maybeResponse as WebMcpToolCallResult;
    }

    if (
      maybeResponse.ok === false &&
      typeof maybeResponse.error?.code === "string" &&
      typeof maybeResponse.error?.message === "string"
    ) {
      return maybeResponse as WebMcpToolCallResult;
    }
  }

  return {
    ok: true,
    data: value
  };
}

class PlaywrightWebMcpPageRuntime implements WebMcpPageRuntime {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  public constructor(private readonly options: CreateWebMcpPageRuntimeOptions) {}

  private requirePage(): Page {
    if (!this.page) {
      throw new Error("Bridge runtime not started. Call start() first.");
    }

    return this.page;
  }

  private createInjectedOptions(): InjectedBridgeOptions {
    return {
      interactive: this.options.interactive,
      allowWriteMode: this.options.writeToolPolicy.mode,
      allowWriteTools: this.options.writeToolPolicy.allowlist
    };
  }

  private async applyInjectedOptions(page: Page): Promise<void> {
    const injectedOptions = this.createInjectedOptions();

    await page.evaluate((options) => {
      const globalObj = window as Window & {
        __webmcpBridge?: {
          setOptions?: (input: InjectedBridgeOptions) => void;
        };
      };

      if (globalObj.__webmcpBridge && typeof globalObj.__webmcpBridge.setOptions === "function") {
        globalObj.__webmcpBridge.setOptions(options);
      }
    }, injectedOptions);
  }

  public async start(): Promise<void> {
    if (this.page) {
      return;
    }

    this.browser = await chromium.launch({
      headless: !this.options.interactive
    });

    this.context = await this.browser.newContext();
    this.page = await this.context.newPage();

    await this.page.addInitScript(INJECTED_BRIDGE_SCRIPT);

    await this.page.goto(this.options.siteUrl, {
      waitUntil: "networkidle",
      timeout: this.options.navigationTimeoutMs ?? 45_000
    });

    await this.page.waitForFunction(() => {
      const globalObj = window as Window & { __webmcpBridge?: unknown };
      return Boolean(globalObj.__webmcpBridge);
    });

    await this.applyInjectedOptions(this.page);
  }

  public async waitForInitialTools(): Promise<WebMcpBridgeTool[]> {
    const page = this.requirePage();
    const timeoutMs = this.options.startupToolWaitMs ?? 8_000;
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const tools = await this.listTools();
      if (tools.length > 0) {
        return tools;
      }

      await page.waitForTimeout(250);
    }

    return this.listTools();
  }

  public async listTools(): Promise<WebMcpBridgeTool[]> {
    const page = this.requirePage();

    const rawTools = await page.evaluate(() => {
      const globalObj = window as Window & {
        __webmcpBridge?: {
          listTools?: () => unknown;
        };
      };

      if (!globalObj.__webmcpBridge || typeof globalObj.__webmcpBridge.listTools !== "function") {
        return [];
      }

      return globalObj.__webmcpBridge.listTools();
    });

    if (!Array.isArray(rawTools)) {
      return [];
    }

    return rawTools.map(normalizeTool).filter((tool): tool is WebMcpBridgeTool => tool !== null);
  }

  public async callTool(name: string, input: unknown): Promise<WebMcpToolCallResult> {
    const page = this.requirePage();

    try {
      const rawResult = await page.evaluate(
        async (args) => {
          const globalObj = window as Window & {
            __webmcpBridge?: {
              callTool?: (toolName: string, toolInput: unknown) => Promise<unknown>;
            };
          };

          if (
            !globalObj.__webmcpBridge ||
            typeof globalObj.__webmcpBridge.callTool !== "function"
          ) {
            return {
              ok: false,
              error: {
                code: "BRIDGE_UNAVAILABLE",
                message: "Injected WebMCP bridge API is unavailable in page context."
              }
            };
          }

          return globalObj.__webmcpBridge.callTool(args.name, args.input);
        },
        {
          name,
          input
        }
      );

      return normalizeToolCallResult(rawResult);
    } catch (error) {
      return toErrorResult(
        "PAGE_EVALUATION_FAILED",
        error instanceof Error ? error.message : "Failed to call tool in browser context."
      );
    }
  }

  public async getInteractionRequests(): Promise<Array<Record<string, unknown>>> {
    const page = this.requirePage();

    const raw = await page.evaluate(() => {
      const globalObj = window as Window & {
        __webmcpBridge?: {
          getInteractionRequests?: () => unknown;
        };
      };

      if (
        !globalObj.__webmcpBridge ||
        typeof globalObj.__webmcpBridge.getInteractionRequests !== "function"
      ) {
        return [];
      }

      return globalObj.__webmcpBridge.getInteractionRequests();
    });

    if (!Array.isArray(raw)) {
      return [];
    }

    return raw.filter((item) => Boolean(item && typeof item === "object")) as Array<
      Record<string, unknown>
    >;
  }

  public async close(): Promise<void> {
    const context = this.context;
    const browser = this.browser;

    this.page = null;
    this.context = null;
    this.browser = null;

    if (context) {
      await context.close();
    }

    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Creates a Playwright runtime that captures and calls WebMCP tools from a website.
 */
export function createWebMcpPageRuntime(
  options: CreateWebMcpPageRuntimeOptions
): WebMcpPageRuntime {
  return new PlaywrightWebMcpPageRuntime(options);
}
