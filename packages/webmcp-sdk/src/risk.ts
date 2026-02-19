import type { ModelContextTool, ToolRisk } from "./types.js";

const toolRiskRegistry = new WeakMap<ModelContextTool, ToolRisk>();

/**
 * Associates a risk label with a tool instance.
 */
export function setToolRisk(tool: ModelContextTool, risk: ToolRisk): void {
  toolRiskRegistry.set(tool, risk);
}

/**
 * Returns risk previously associated with a tool, if present.
 */
export function getToolRisk(tool: ModelContextTool): ToolRisk | null {
  return toolRiskRegistry.get(tool) ?? null;
}

/**
 * Best-effort risk inference for tools without an explicit registry entry.
 */
export function inferToolRisk(tool: ModelContextTool): ToolRisk {
  const registeredRisk = getToolRisk(tool);
  if (registeredRisk) {
    return registeredRisk;
  }

  return tool.annotations?.readOnlyHint === true ? "read" : "write";
}
