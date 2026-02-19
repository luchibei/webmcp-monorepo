import {
  clearContextSafe,
  isWebMcpSupported,
  provideContextSafe,
  registerToolsSafe,
  type ModelContextTool
} from "@luchibei/webmcp-sdk";
import { useEffect, type PropsWithChildren } from "react";

/**
 * Registration strategy used by `WebMcpProvider`.
 */
export type WebMcpRegistrationStrategy = "provideContext" | "registerTool";

/**
 * Props for `WebMcpProvider`.
 */
export interface WebMcpProviderProps extends PropsWithChildren {
  /**
   * Tools to expose through WebMCP.
   */
  tools: ModelContextTool[];

  /**
   * Registration mode.
   *
   * - `registerTool` (default): component-friendly incremental registration.
   * - `provideContext`: replaces context-level tools and clears old context.
   */
  strategy?: WebMcpRegistrationStrategy;
}

/**
 * Registers WebMCP tools for the mounted React subtree.
 */
export function WebMcpProvider({
  tools,
  strategy = "registerTool",
  children
}: WebMcpProviderProps) {
  useEffect(() => {
    let active = true;
    let cleanup: (() => Promise<void>) | null = null;

    const run = async () => {
      if (!isWebMcpSupported()) {
        return;
      }

      if (strategy === "provideContext") {
        await clearContextSafe();

        if (!active) {
          return;
        }

        await provideContextSafe({ tools });

        cleanup = async () => {
          await clearContextSafe();
        };

        return;
      }

      const handle = await registerToolsSafe(tools);

      if (!active) {
        await handle.unregisterAll();
        return;
      }

      cleanup = handle.unregisterAll;
    };

    void run();

    return () => {
      active = false;

      if (cleanup) {
        void cleanup();
        return;
      }

      if (strategy === "provideContext") {
        void clearContextSafe();
      }
    };
  }, [strategy, tools]);

  return <>{children}</>;
}
