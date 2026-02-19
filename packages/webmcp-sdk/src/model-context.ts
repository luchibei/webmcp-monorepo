import { evaluateToolPolicy } from "./policy.js";
import type { ModelContext, ModelContextOptions, ModelContextTool } from "./types.js";
import type { ToolPolicy } from "./policy.js";

type NavigatorWithModelContext = Navigator & {
  modelContext?: ModelContext;
};

type UnregisterHandle = {
  unregister(): Promise<void>;
};

type UnregisterAllHandle = {
  unregisterAll(): Promise<void>;
};

type RegisterToolSafeOptions = {
  policy?: ToolPolicy;
};

type RegisterToolsSafeOptions = {
  policy?: ToolPolicy;
};

function isSecureRuntime(): boolean {
  if (typeof globalThis.isSecureContext === "boolean") {
    return globalThis.isSecureContext;
  }

  return true;
}

function asPromise(value: void | Promise<void>): Promise<void> {
  return Promise.resolve(value);
}

function hasModelContextShape(value: unknown): value is ModelContext {
  if (!value || typeof value !== "object") {
    return false;
  }

  const context = value as Partial<ModelContext>;
  return (
    typeof context.provideContext === "function" &&
    typeof context.registerTool === "function" &&
    typeof context.clearContext === "function" &&
    typeof context.unregisterTool === "function"
  );
}

/**
 * Returns the browser WebMCP `modelContext` if available and secure.
 */
export function getModelContext(): ModelContext | null {
  try {
    if (!isSecureRuntime()) {
      return null;
    }

    const navigatorRef = (globalThis as { navigator?: NavigatorWithModelContext }).navigator;
    const modelContextRef = navigatorRef?.modelContext;

    if (!hasModelContextShape(modelContextRef)) {
      return null;
    }

    return modelContextRef;
  } catch {
    return null;
  }
}

/**
 * Checks whether WebMCP APIs are available in the current runtime.
 */
export function isWebMcpSupported(): boolean {
  return getModelContext() !== null;
}

/**
 * Safe wrapper around `navigator.modelContext.provideContext`.
 */
export async function provideContextSafe(options: ModelContextOptions): Promise<void> {
  try {
    const modelContext = getModelContext();
    if (!modelContext) {
      return;
    }

    await asPromise(modelContext.provideContext(options));
  } catch {
    // no-op by design
  }
}

/**
 * Safe wrapper around `navigator.modelContext.clearContext`.
 */
export async function clearContextSafe(): Promise<void> {
  try {
    const modelContext = getModelContext();
    if (!modelContext) {
      return;
    }

    await asPromise(modelContext.clearContext());
  } catch {
    // no-op by design
  }
}

/**
 * Safe wrapper around `navigator.modelContext.unregisterTool`.
 */
export async function unregisterToolSafe(name: string): Promise<void> {
  try {
    const modelContext = getModelContext();
    if (!modelContext) {
      return;
    }

    await asPromise(modelContext.unregisterTool(name));
  } catch {
    // no-op by design
  }
}

/**
 * Safe wrapper around `navigator.modelContext.registerTool`.
 *
 * Returns a local unregister handle for convenience.
 */
export async function registerToolSafe(
  tool: ModelContextTool,
  options: RegisterToolSafeOptions = {}
): Promise<UnregisterHandle> {
  const policyResult = evaluateToolPolicy(tool, options.policy);
  if (!policyResult.allow) {
    return {
      unregister: async () => undefined
    };
  }

  try {
    const modelContext = getModelContext();
    if (modelContext) {
      await asPromise(modelContext.registerTool(tool));
    }
  } catch {
    // no-op by design
  }

  return {
    unregister: async () => unregisterToolSafe(tool.name)
  };
}

/**
 * Registers multiple tools safely.
 */
export async function registerToolsSafe(
  tools: ModelContextTool[],
  options: RegisterToolsSafeOptions = {}
): Promise<UnregisterAllHandle> {
  const registeredToolNames: string[] = [];

  for (const tool of tools) {
    const policyResult = evaluateToolPolicy(tool, options.policy);
    if (!policyResult.allow) {
      continue;
    }

    await registerToolSafe(tool);
    registeredToolNames.push(tool.name);
  }

  return {
    unregisterAll: async () => {
      for (const toolName of [...registeredToolNames].reverse()) {
        await unregisterToolSafe(toolName);
      }
    }
  };
}

export type {
  RegisterToolsSafeOptions,
  RegisterToolSafeOptions,
  UnregisterAllHandle,
  UnregisterHandle
};
