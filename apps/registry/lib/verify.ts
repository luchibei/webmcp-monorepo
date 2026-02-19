import Ajv from "ajv";
import { chromium } from "playwright";

export interface CapturedToolInfo {
  name: string;
  description: string;
  readOnlyHint: boolean;
  inputSchema: Record<string, unknown> | null;
}

export interface VerifiedToolReport {
  name: string;
  description: string;
  readOnlyHint: boolean;
  risk: "read" | "unknown/write";
  schemaValid: boolean;
  schemaSummary: string;
}

export interface VerifyReport {
  url: string;
  toolCount: number;
  tools: VerifiedToolReport[];
  warnings: string[];
  errors: string[];
  capturedCalls: Array<{
    method: string;
    timestamp: number;
  }>;
  verifiedAt: string;
}

const CAPTURE_INIT_SCRIPT = `(() => {
  const globalObj = window;
  const captured = globalObj.__capturedWebmcp ?? {
    tools: new Map(),
    calls: []
  };

  globalObj.__capturedWebmcp = captured;

  const normalizeTool = (tool) => {
    if (!tool || typeof tool !== 'object') {
      return null;
    }

    if (typeof tool.name !== 'string' || tool.name.trim() === '') {
      return null;
    }

    return {
      name: tool.name,
      description: typeof tool.description === 'string' ? tool.description : '',
      readOnlyHint: Boolean(tool.annotations && tool.annotations.readOnlyHint),
      inputSchema: tool.inputSchema && typeof tool.inputSchema === 'object' ? tool.inputSchema : null
    };
  };

  const recordTool = (tool) => {
    const normalized = normalizeTool(tool);
    if (!normalized) {
      return;
    }
    captured.tools.set(normalized.name, normalized);
  };

  const recordCall = (method) => {
    captured.calls.push({
      method,
      timestamp: Date.now()
    });
  };

  let underlying = navigator.modelContext;

  const wrapper = {
    provideContext(options) {
      recordCall('provideContext');
      if (options && Array.isArray(options.tools)) {
        options.tools.forEach((tool) => recordTool(tool));
      }
      if (underlying && underlying !== wrapper && typeof underlying.provideContext === 'function') {
        return underlying.provideContext(options);
      }
      return undefined;
    },
    registerTool(tool) {
      recordCall('registerTool');
      recordTool(tool);
      if (underlying && underlying !== wrapper && typeof underlying.registerTool === 'function') {
        return underlying.registerTool(tool);
      }
      return undefined;
    },
    clearContext() {
      recordCall('clearContext');
      if (underlying && underlying !== wrapper && typeof underlying.clearContext === 'function') {
        return underlying.clearContext();
      }
      return undefined;
    },
    unregisterTool(name) {
      recordCall('unregisterTool');
      if (underlying && underlying !== wrapper && typeof underlying.unregisterTool === 'function') {
        return underlying.unregisterTool(name);
      }
      return undefined;
    }
  };

  try {
    Object.defineProperty(navigator, 'modelContext', {
      configurable: true,
      get() {
        return wrapper;
      },
      set(value) {
        underlying = value;
      }
    });
  } catch {
    if (underlying && typeof underlying === 'object') {
      const target = underlying;

      const originalProvideContext =
        typeof target.provideContext === 'function' ? target.provideContext.bind(target) : undefined;
      const originalRegisterTool =
        typeof target.registerTool === 'function' ? target.registerTool.bind(target) : undefined;
      const originalClearContext =
        typeof target.clearContext === 'function' ? target.clearContext.bind(target) : undefined;
      const originalUnregisterTool =
        typeof target.unregisterTool === 'function' ? target.unregisterTool.bind(target) : undefined;

      target.provideContext = (options) => {
        recordCall('provideContext');
        if (options && Array.isArray(options.tools)) {
          options.tools.forEach((tool) => recordTool(tool));
        }
        return originalProvideContext ? originalProvideContext(options) : undefined;
      };

      target.registerTool = (tool) => {
        recordCall('registerTool');
        recordTool(tool);
        return originalRegisterTool ? originalRegisterTool(tool) : undefined;
      };

      target.clearContext = () => {
        recordCall('clearContext');
        return originalClearContext ? originalClearContext() : undefined;
      };

      target.unregisterTool = (name) => {
        recordCall('unregisterTool');
        return originalUnregisterTool ? originalUnregisterTool(name) : undefined;
      };
    }
  }
})();`;

function isObjectSchema(inputSchema: unknown): boolean {
  if (!inputSchema || typeof inputSchema !== "object" || Array.isArray(inputSchema)) {
    return false;
  }

  const schema = inputSchema as Record<string, unknown>;
  if (schema.type === "object") {
    return true;
  }

  if (schema.properties && typeof schema.properties === "object") {
    return true;
  }

  return false;
}

function summarizeSchema(inputSchema: unknown): string {
  if (!inputSchema || typeof inputSchema !== "object" || Array.isArray(inputSchema)) {
    return "invalid-schema";
  }

  const schema = inputSchema as Record<string, unknown>;
  const type = typeof schema.type === "string" ? schema.type : "unknown";

  const properties =
    schema.properties && typeof schema.properties === "object"
      ? Object.keys(schema.properties as Record<string, unknown>)
      : [];

  const preview = properties.slice(0, 4).join(",");
  return `type=${type}; props=${preview || "none"}`;
}

function inferRiskFromReadOnlyHint(readOnlyHint: boolean): "read" | "unknown/write" {
  return readOnlyHint ? "read" : "unknown/write";
}

function normalizeUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hash = "";

  if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  }

  return parsed.toString();
}

/**
 * Verifies a website's WebMCP registration behavior and returns structured report.
 */
export async function verifyWebMcpSite(rawUrl: string): Promise<VerifyReport> {
  const normalizedUrl = normalizeUrl(rawUrl);
  const warnings: string[] = [];
  const errors: string[] = [];

  const ajv = new Ajv({
    strict: false,
    allErrors: true,
    validateSchema: true
  });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  try {
    await context.addInitScript(CAPTURE_INIT_SCRIPT);

    const page = await context.newPage();

    try {
      await page.goto(normalizedUrl, {
        waitUntil: "networkidle",
        timeout: 45_000
      });
    } catch (error) {
      errors.push(
        error instanceof Error ? `Navigation failed: ${error.message}` : "Navigation failed."
      );
    }

    await page.waitForTimeout(1_500);

    const captured = await page.evaluate(() => {
      const globalObj = window as Window & {
        __capturedWebmcp?: {
          tools?: Map<string, unknown>;
          calls?: Array<{ method?: string; timestamp?: number }>;
        };
      };

      const tools = Array.from(globalObj.__capturedWebmcp?.tools?.values?.() ?? []);
      const calls = Array.isArray(globalObj.__capturedWebmcp?.calls)
        ? globalObj.__capturedWebmcp?.calls
        : [];

      return {
        tools,
        calls
      };
    });

    const tools = (captured.tools as CapturedToolInfo[]).map((tool) => {
      const schemaCandidate = tool.inputSchema;
      const schemaSummary = summarizeSchema(schemaCandidate);

      let schemaValid = false;

      if (!isObjectSchema(schemaCandidate)) {
        schemaValid = false;
      } else {
        const isJsonSchemaValid = ajv.validateSchema(schemaCandidate as Record<string, unknown>);
        schemaValid = Boolean(isJsonSchemaValid);
      }

      return {
        name: tool.name,
        description: tool.description,
        readOnlyHint: tool.readOnlyHint,
        risk: inferRiskFromReadOnlyHint(tool.readOnlyHint),
        schemaValid,
        schemaSummary
      } satisfies VerifiedToolReport;
    });

    if (tools.length === 0) {
      warnings.push("No WebMCP tools were captured during page load.");
    }

    const invalidSchemaTools = tools.filter((tool) => !tool.schemaValid).map((tool) => tool.name);
    if (invalidSchemaTools.length > 0) {
      warnings.push(`Tools with invalid schema: ${invalidSchemaTools.join(", ")}`);
    }

    const nonReadTools = tools.filter((tool) => tool.risk !== "read").map((tool) => tool.name);
    if (nonReadTools.length > 0) {
      warnings.push(
        `Tools with inferred non-read risk (unknown/write): ${nonReadTools.join(", ")}. Review before enabling unrestricted agent access.`
      );
    }

    return {
      url: normalizedUrl,
      toolCount: tools.length,
      tools,
      warnings,
      errors,
      capturedCalls: (captured.calls as Array<{ method?: string; timestamp?: number }>).map(
        (call) => ({
          method: typeof call.method === "string" ? call.method : "unknown",
          timestamp: typeof call.timestamp === "number" ? call.timestamp : Date.now()
        })
      ),
      verifiedAt: new Date().toISOString()
    };
  } finally {
    await context.close();
    await browser.close();
  }
}
