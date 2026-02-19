import { createSwToolBridge } from "@webmcp/webmcp-sw-runtime";

import { shopStore } from "./shop-store";

const shopSwBridge = createSwToolBridge({
  serviceWorkerPath: "/webmcp-shop-sw.js",
  timeoutMs: 3_500
});

/**
 * Returns singleton page-to-SW bridge.
 */
export function getShopSwBridge() {
  return shopSwBridge;
}

/**
 * Sends current checkout state to service worker for background preparation.
 */
export async function syncCheckoutStateToSw() {
  const state = shopStore.getState();
  const cart = shopStore.getCart();

  return shopSwBridge.callInSw("__syncCheckoutState", {
    type: "WEBMCP_TOOL_CALL",
    tool: "__syncCheckoutState",
    input: {
      cart,
      shippingAddress: state.shippingAddress
    }
  });
}

/**
 * Checks if bridge has a ready SW registration.
 */
export function isShopSwBridgeReady(): boolean {
  return shopSwBridge.isReady();
}
