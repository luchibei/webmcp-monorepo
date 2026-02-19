"use client";

import { isWebMcpSupported } from "@luchibei/webmcp-sdk";
import { useMemo, useState } from "react";

import { isShopSwBridgeReady, syncCheckoutStateToSw } from "@/lib/sw-bridge";
import { executeToolByName, getShopToolManifest } from "@/lib/webmcp-tools";

const SAMPLE_INPUTS: Record<string, unknown> = {
  searchProducts: { q: "headphones", limit: 4 },
  getProduct: { id: "p-aurora-headphones" },
  addToCart: { productId: "p-aurora-headphones", quantity: 1 },
  getCart: {},
  setShippingAddress: {
    name: "Taylor Jordan",
    phone: "555-0123",
    address: "120 8th Ave, New York, NY"
  },
  prepareCheckout: {},
  placeOrder: {},
  getOrderStatus: { orderId: "ORD-DEMO" }
};

export default function ToolsPage() {
  const manifest = useMemo(() => getShopToolManifest(), []);
  const [selectedTool, setSelectedTool] = useState(manifest[0]?.name ?? "searchProducts");
  const [inputText, setInputText] = useState(
    JSON.stringify(SAMPLE_INPUTS[manifest[0]?.name ?? "searchProducts"], null, 2)
  );
  const [output, setOutput] = useState<string>("Run a tool to inspect output.");
  const [syncStatus, setSyncStatus] = useState<string>("idle");

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section>
        <h1 className="page-title">Tool Registry</h1>
        <p className="page-subtitle">
          These are the tools registered by <code>WebMcpProvider</code>. Use this page for manual
          checks.
        </p>
      </section>

      <section className="section-card">
        <p>
          WebMCP support in current browser: <strong>{isWebMcpSupported() ? "Yes" : "No"}</strong>
        </p>
        <p>
          SW bridge ready: <strong>{isShopSwBridgeReady() ? "Yes" : "No"}</strong>
        </p>
        <div className="button-row" style={{ marginBottom: 14 }}>
          <button
            className="button button-secondary"
            type="button"
            data-testid="manual-sync-sw"
            onClick={async () => {
              const result = await syncCheckoutStateToSw();
              setSyncStatus(result.ok ? "synced" : `sync failed: ${result.error.code}`);
            }}
          >
            Sync Checkout Context To SW
          </button>
          <span className="muted" data-testid="sync-status">
            {syncStatus}
          </span>
        </div>

        <div className="tool-list" data-testid="tool-manifest-list">
          {manifest.map((tool) => (
            <article key={tool.name} className="tool-row" data-testid={`tool-row-${tool.name}`}>
              <strong>{tool.name}</strong>
              <p className="muted">{tool.description}</p>
              <p className="muted">readOnlyHint: {tool.readOnlyHint ? "true" : "false"}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-card">
        <h2 style={{ marginTop: 0 }}>Manual Tool Runner</h2>
        <p className="muted">
          This helper executes tool functions directly in page context to verify behavior.
        </p>

        <div style={{ display: "grid", gap: 10 }}>
          <select
            className="select"
            value={selectedTool}
            onChange={(event) => {
              const name = event.target.value;
              setSelectedTool(name);
              setInputText(JSON.stringify(SAMPLE_INPUTS[name] ?? {}, null, 2));
            }}
            data-testid="manual-tool-select"
          >
            {manifest.map((tool) => (
              <option key={tool.name} value={tool.name}>
                {tool.name}
              </option>
            ))}
          </select>

          <textarea
            className="textarea"
            value={inputText}
            onChange={(event) => {
              setInputText(event.target.value);
            }}
            data-testid="manual-tool-input"
          />

          <div className="button-row">
            <button
              className="button button-primary"
              type="button"
              data-testid="manual-tool-run"
              onClick={async () => {
                try {
                  const parsed = JSON.parse(inputText);
                  const result = await executeToolByName({
                    name: selectedTool,
                    input: parsed
                  });
                  setOutput(JSON.stringify(result, null, 2));
                } catch (error) {
                  const message = error instanceof Error ? error.message : "Tool execution failed.";
                  setOutput(
                    JSON.stringify(
                      { ok: false, error: { code: "MANUAL_RUN_ERROR", message } },
                      null,
                      2
                    )
                  );
                }
              }}
            >
              Run Tool
            </button>
          </div>

          <pre data-testid="manual-tool-output">{output}</pre>
        </div>
      </section>
    </div>
  );
}
