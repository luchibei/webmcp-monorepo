// @vitest-environment jsdom

import type { ModelContext, ModelContextTool } from "@luchibei/webmcp-sdk";
import { cleanup, render, waitFor } from "@testing-library/react";
import React, { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WebMcpProvider, useWebMcpTool, useWebMcpTools } from "../src/index";

function createTool(name: string): ModelContextTool {
  return {
    name,
    description: `${name} description`,
    inputSchema: {
      type: "object",
      properties: {}
    },
    execute: async () => ({ name })
  };
}

function installModelContext(overrides: Partial<ModelContext> = {}) {
  const modelContext: ModelContext = {
    provideContext: vi.fn(() => undefined),
    registerTool: vi.fn(() => undefined),
    clearContext: vi.fn(() => undefined),
    unregisterTool: vi.fn(() => undefined),
    ...overrides
  };

  Object.defineProperty(window.navigator, "modelContext", {
    configurable: true,
    writable: true,
    value: modelContext
  });

  vi.stubGlobal("isSecureContext", true);
  return modelContext;
}

function uninstallModelContext() {
  Object.defineProperty(window.navigator, "modelContext", {
    configurable: true,
    writable: true,
    value: undefined
  });
}

function SingleToolHarness({
  tool,
  enabled = true
}: {
  tool: ModelContextTool;
  enabled?: boolean;
}) {
  useWebMcpTool(tool, enabled);
  return React.createElement("div");
}

function MultiToolHarness({
  tools,
  enabled = true
}: {
  tools: ModelContextTool[];
  enabled?: boolean;
}) {
  useWebMcpTools(tools, enabled);
  return React.createElement("div");
}

function StatusHarness({
  tool,
  onStatus
}: {
  tool: ModelContextTool;
  onStatus: (value: boolean) => void;
}) {
  const { registered } = useWebMcpTool(tool, true);

  useEffect(() => {
    onStatus(registered);
  }, [onStatus, registered]);

  return React.createElement("div");
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

afterEach(() => {
  cleanup();
  uninstallModelContext();
});

describe("useWebMcpTool", () => {
  it("does not register when enabled is false", async () => {
    const modelContext = installModelContext();

    render(
      React.createElement(SingleToolHarness, { tool: createTool("disabledTool"), enabled: false })
    );

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(modelContext.registerTool).not.toHaveBeenCalled();
  });

  it("cleans up on unmount", async () => {
    const modelContext = installModelContext();
    const tool = createTool("singleCleanup");

    const view = render(React.createElement(SingleToolHarness, { tool }));

    await waitFor(() => {
      expect(modelContext.registerTool).toHaveBeenCalledWith(tool);
    });

    view.unmount();

    await waitFor(() => {
      expect(modelContext.unregisterTool).toHaveBeenCalledWith(tool.name);
    });
  });

  it("stays unregistered when WebMCP is unsupported", async () => {
    vi.stubGlobal("isSecureContext", false);
    uninstallModelContext();

    const statusSpy = vi.fn<(value: boolean) => void>();
    render(
      React.createElement(StatusHarness, { tool: createTool("unsupported"), onStatus: statusSpy })
    );

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(statusSpy).toHaveBeenLastCalledWith(false);
  });
});

describe("useWebMcpTools", () => {
  it("registers new tools and unregisters old ones when tools change", async () => {
    const modelContext = installModelContext();
    const toolA = createTool("toolA");
    const toolB = createTool("toolB");

    const view = render(React.createElement(MultiToolHarness, { tools: [toolA] }));

    await waitFor(() => {
      expect(modelContext.registerTool).toHaveBeenCalledWith(toolA);
    });

    view.rerender(React.createElement(MultiToolHarness, { tools: [toolB] }));

    await waitFor(() => {
      expect(modelContext.unregisterTool).toHaveBeenCalledWith(toolA.name);
      expect(modelContext.registerTool).toHaveBeenCalledWith(toolB);
    });
  });
});

describe("WebMcpProvider", () => {
  it("mounts and unmounts tools with registerTool strategy", async () => {
    const modelContext = installModelContext();
    const toolA = createTool("providerA");
    const toolB = createTool("providerB");

    const view = render(
      React.createElement(
        WebMcpProvider,
        { tools: [toolA, toolB] },
        React.createElement("div", null, "child")
      )
    );

    await waitFor(() => {
      expect(modelContext.registerTool).toHaveBeenCalledWith(toolA);
      expect(modelContext.registerTool).toHaveBeenCalledWith(toolB);
    });

    view.unmount();

    await waitFor(() => {
      expect(modelContext.unregisterTool).toHaveBeenNthCalledWith(1, toolB.name);
      expect(modelContext.unregisterTool).toHaveBeenNthCalledWith(2, toolA.name);
    });
  });

  it("replaces context with provideContext strategy", async () => {
    const modelContext = installModelContext();
    const first = createTool("firstContextTool");
    const second = createTool("secondContextTool");

    const view = render(
      React.createElement(WebMcpProvider, {
        tools: [first],
        strategy: "provideContext"
      })
    );

    await waitFor(() => {
      expect(modelContext.clearContext).toHaveBeenCalledTimes(1);
      expect(modelContext.provideContext).toHaveBeenCalledWith({ tools: [first] });
    });

    view.rerender(
      React.createElement(WebMcpProvider, {
        tools: [second],
        strategy: "provideContext"
      })
    );

    await waitFor(() => {
      expect(modelContext.clearContext).toHaveBeenCalledTimes(3);
      expect(modelContext.provideContext).toHaveBeenCalledWith({ tools: [second] });
    });
  });

  it("does not crash when WebMCP is unavailable", async () => {
    vi.stubGlobal("isSecureContext", false);
    uninstallModelContext();

    expect(() =>
      render(
        React.createElement(
          WebMcpProvider,
          { tools: [createTool("noSupport")] },
          React.createElement("div", null, "safe")
        )
      )
    ).not.toThrow();

    await new Promise((resolve) => setTimeout(resolve, 10));
  });
});
