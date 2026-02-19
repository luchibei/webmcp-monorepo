import {
  isWebMcpSupported,
  registerToolsSafe,
  registerToolSafe,
  type ModelContextTool
} from "@webmcp/webmcp-sdk";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Result for `useWebMcpTool`.
 */
export interface UseWebMcpToolResult {
  registered: boolean;
  unregister: () => Promise<void>;
}

/**
 * Result for `useWebMcpTools`.
 */
export interface UseWebMcpToolsResult {
  registered: boolean;
  unregisterAll: () => Promise<void>;
  unregister: () => Promise<void>;
}

function useSafeRegisteredState() {
  const [registered, setRegistered] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const setRegisteredSafe = useCallback((value: boolean) => {
    if (mountedRef.current) {
      setRegistered(value);
    }
  }, []);

  return {
    registered,
    setRegisteredSafe
  };
}

/**
 * Registers a single WebMCP tool for the component lifecycle.
 */
export function useWebMcpTool(
  tool: ModelContextTool,
  enabled: boolean = true
): UseWebMcpToolResult {
  const cleanupRef = useRef<(() => Promise<void>) | null>(null);
  const { registered, setRegisteredSafe } = useSafeRegisteredState();

  const unregister = useCallback(async () => {
    const cleanup = cleanupRef.current;
    cleanupRef.current = null;

    if (cleanup) {
      await cleanup();
    }

    setRegisteredSafe(false);
  }, [setRegisteredSafe]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      await unregister();

      if (!active || !enabled || !isWebMcpSupported()) {
        return;
      }

      const handle = await registerToolSafe(tool);

      if (!active) {
        await handle.unregister();
        return;
      }

      cleanupRef.current = handle.unregister;
      setRegisteredSafe(true);
    };

    void run();

    return () => {
      active = false;
      void unregister();
    };
  }, [enabled, tool, unregister, setRegisteredSafe]);

  return {
    registered,
    unregister
  };
}

/**
 * Registers multiple WebMCP tools for the component lifecycle.
 */
export function useWebMcpTools(
  tools: ModelContextTool[],
  enabled: boolean = true
): UseWebMcpToolsResult {
  const cleanupRef = useRef<(() => Promise<void>) | null>(null);
  const { registered, setRegisteredSafe } = useSafeRegisteredState();

  const unregisterAll = useCallback(async () => {
    const cleanup = cleanupRef.current;
    cleanupRef.current = null;

    if (cleanup) {
      await cleanup();
    }

    setRegisteredSafe(false);
  }, [setRegisteredSafe]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      await unregisterAll();

      if (!active || !enabled || !isWebMcpSupported()) {
        return;
      }

      const handle = await registerToolsSafe(tools);

      if (!active) {
        await handle.unregisterAll();
        return;
      }

      cleanupRef.current = handle.unregisterAll;
      setRegisteredSafe(true);
    };

    void run();

    return () => {
      active = false;
      void unregisterAll();
    };
  }, [enabled, tools, unregisterAll, setRegisteredSafe]);

  return {
    registered,
    unregisterAll,
    unregister: unregisterAll
  };
}
