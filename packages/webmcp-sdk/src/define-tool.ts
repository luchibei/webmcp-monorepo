import { zodToJsonSchema } from "zod-to-json-schema";
import type { z } from "zod";

import { WebMcpSdkError } from "./errors.js";
import { fail, isToolResponse } from "./response.js";
import type { ToolResponse } from "./response.js";
import { setToolRisk } from "./risk.js";
import type { ModelContextClient, ModelContextTool, ToolAnnotations, ToolRisk } from "./types.js";

/**
 * Input options for `defineTool`.
 */
export interface DefineToolOptions<TInputSchema extends z.ZodTypeAny, TResult> {
  name: string;
  description: string;
  input: TInputSchema;
  /**
   * Optional upper-layer risk label.
   */
  risk?: ToolRisk;
  readOnlyHint?: boolean;
  execute: (input: z.infer<TInputSchema>, client: ModelContextClient) => TResult | Promise<TResult>;
}

/**
 * Tool shape returned by `defineTool`.
 */
export type DefinedTool<TInputSchema extends z.ZodTypeAny, TResult> = ModelContextTool<
  z.infer<TInputSchema>,
  TResult | ToolResponse<unknown>
> & {
  inputSchema: Record<string, unknown>;
};

function toErrorDetails(error: unknown): unknown {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return error;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Tool execution failed.";
}

function createInputSchema(toolName: string, schema: z.ZodTypeAny): Record<string, unknown> {
  try {
    const jsonSchema = zodToJsonSchema(schema, {
      $refStrategy: "none"
    });

    if (!jsonSchema || typeof jsonSchema !== "object") {
      throw new Error("Schema generation returned a non-object value.");
    }

    return jsonSchema as Record<string, unknown>;
  } catch (error) {
    throw new WebMcpSdkError(
      "SCHEMA_GENERATION_FAILED",
      `Failed to generate inputSchema for tool "${toolName}".`,
      toErrorDetails(error)
    );
  }
}

function inferRisk(readOnlyHint: boolean | undefined): ToolRisk {
  if (readOnlyHint === true) {
    return "read";
  }

  return "write";
}

function resolveRiskAndReadOnlyHint(options: {
  risk: ToolRisk | undefined;
  readOnlyHint: boolean | undefined;
}): {
  risk: ToolRisk;
  readOnlyHint: boolean | undefined;
} {
  const risk = options.risk ?? inferRisk(options.readOnlyHint);
  const riskMappedReadOnlyHint = risk === "read";

  if (options.readOnlyHint !== undefined && options.readOnlyHint !== riskMappedReadOnlyHint) {
    throw new WebMcpSdkError(
      "RISK_READONLY_CONFLICT",
      `Risk "${risk}" conflicts with readOnlyHint=${String(options.readOnlyHint)}.`
    );
  }

  if (options.risk !== undefined) {
    return {
      risk,
      readOnlyHint: riskMappedReadOnlyHint
    };
  }

  return {
    risk,
    readOnlyHint: options.readOnlyHint
  };
}

function createAnnotations(readOnlyHint?: boolean): ToolAnnotations | undefined {
  if (readOnlyHint === undefined) {
    return undefined;
  }

  return { readOnlyHint };
}

function attachRiskMetadata<T>(response: ToolResponse<T>, risk: ToolRisk): ToolResponse<T> {
  return {
    ...response,
    metadata: {
      ...(response.metadata ?? {}),
      risk
    }
  };
}

/**
 * Defines a WebMCP tool from a Zod schema and executor.
 */
export function defineTool<TInputSchema extends z.ZodTypeAny, TResult>(
  options: DefineToolOptions<TInputSchema, TResult>
): DefinedTool<TInputSchema, TResult> {
  const name = options.name.trim();
  const description = options.description.trim();

  if (!name) {
    throw new WebMcpSdkError("INVALID_TOOL_NAME", "Tool name must be a non-empty string.");
  }

  if (!description) {
    throw new WebMcpSdkError(
      "INVALID_TOOL_DESCRIPTION",
      "Tool description must be a non-empty string."
    );
  }

  const inputSchema = createInputSchema(name, options.input);
  const resolvedRisk = resolveRiskAndReadOnlyHint({
    risk: options.risk,
    readOnlyHint: options.readOnlyHint
  });
  const annotations = createAnnotations(resolvedRisk.readOnlyHint);

  const tool: DefinedTool<TInputSchema, TResult> = {
    name,
    description,
    inputSchema,
    ...(annotations ? { annotations } : {}),
    async execute(rawInput: unknown, client: ModelContextClient) {
      const parseResult = options.input.safeParse(rawInput);

      if (!parseResult.success) {
        return attachRiskMetadata(
          fail("INVALID_INPUT", "Tool input validation failed.", {
            issues: parseResult.error.issues
          }),
          resolvedRisk.risk
        );
      }

      try {
        const result = await options.execute(parseResult.data, client);
        return isToolResponse(result) ? attachRiskMetadata(result, resolvedRisk.risk) : result;
      } catch (error) {
        return attachRiskMetadata(
          fail("TOOL_EXECUTION_ERROR", toErrorMessage(error), {
            cause: toErrorDetails(error)
          }),
          resolvedRisk.risk
        );
      }
    }
  };

  setToolRisk(tool, resolvedRisk.risk);

  return tool;
}
