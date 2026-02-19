import { inferToolRisk } from "./risk.js";
import type { ModelContextTool, ToolRisk } from "./types.js";

export interface ToolPolicyContext {
  risk: ToolRisk;
}

export interface ToolPolicyResult {
  allow: boolean;
  reason?: string;
  risk: ToolRisk;
}

export type ToolPolicy = (tool: ModelContextTool, context: ToolPolicyContext) => ToolPolicyResult;

export interface CreateToolPolicyOptions {
  /**
   * Blocks non-read tools when enabled.
   */
  defaultDenyWrite?: boolean;

  /**
   * Risks that require explicit confirmation before registration.
   * Without an external confirmation hook, these are denied by default.
   */
  requireConfirmationForRisk?: ToolRisk[];
}

/**
 * Creates a reusable registration policy for WebMCP tools.
 */
export function createToolPolicy(options: CreateToolPolicyOptions = {}): ToolPolicy {
  const requireConfirmationForRisk = new Set(options.requireConfirmationForRisk ?? []);

  return (tool, context) => {
    const risk = context.risk;

    if (options.defaultDenyWrite === true && risk !== "read") {
      return {
        allow: false,
        reason: `Tool "${tool.name}" blocked by defaultDenyWrite policy (risk=${risk}).`,
        risk
      };
    }

    if (requireConfirmationForRisk.has(risk)) {
      return {
        allow: false,
        reason: `Tool "${tool.name}" requires explicit confirmation for risk=${risk}.`,
        risk
      };
    }

    return {
      allow: true,
      risk
    };
  };
}

/**
 * Evaluates a tool against a policy using inferred risk metadata.
 */
export function evaluateToolPolicy(tool: ModelContextTool, policy?: ToolPolicy): ToolPolicyResult {
  const risk = inferToolRisk(tool);

  if (!policy) {
    return {
      allow: true,
      risk
    };
  }

  return policy(tool, { risk });
}
