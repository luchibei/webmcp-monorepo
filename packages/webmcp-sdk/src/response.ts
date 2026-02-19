import type { ToolRisk } from "./types.js";

/**
 * Standardized tool error payload.
 */
export interface ToolError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Optional response metadata for policy and observability layers.
 */
export interface ToolResponseMetadata {
  risk?: ToolRisk;
}

/**
 * Standardized tool response union.
 */
export type ToolResponse<T> =
  | {
      ok: true;
      data: T;
      metadata?: ToolResponseMetadata;
    }
  | {
      ok: false;
      error: ToolError;
      metadata?: ToolResponseMetadata;
    };

/**
 * Creates a successful `ToolResponse`.
 */
export function ok<T>(data: T, metadata?: ToolResponseMetadata): ToolResponse<T> {
  return {
    ok: true,
    data,
    ...(metadata ? { metadata } : {})
  };
}

/**
 * Creates a failed `ToolResponse`.
 */
export function fail(
  code: string,
  message: string,
  details?: unknown,
  metadata?: ToolResponseMetadata
): ToolResponse<never> {
  const error: ToolError = details === undefined ? { code, message } : { code, message, details };

  return {
    ok: false,
    error,
    ...(metadata ? { metadata } : {})
  };
}

/**
 * Runtime type guard for `ToolResponse`.
 */
export function isToolResponse(value: unknown): value is ToolResponse<unknown> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeResponse = value as Partial<ToolResponse<unknown>> & {
    error?: Partial<ToolError>;
  };

  if (maybeResponse.ok === true) {
    return "data" in maybeResponse;
  }

  if (maybeResponse.ok === false) {
    return (
      typeof maybeResponse.error?.code === "string" &&
      typeof maybeResponse.error?.message === "string"
    );
  }

  return false;
}
