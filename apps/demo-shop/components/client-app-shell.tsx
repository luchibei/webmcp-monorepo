"use client";

import Link from "next/link";
import { WebMcpProvider } from "@webmcp/webmcp-react";
import { useEffect } from "react";

import { isShopSwBridgeReady, syncCheckoutStateToSw } from "@/lib/sw-bridge";
import { getShopTools } from "@/lib/webmcp-tools";
import { shopStore, useShopState } from "@/lib/shop-store";

import { OrderConfirmationDialog } from "./order-confirmation-dialog";

/**
 * Global client shell with WebMCP registration and top navigation.
 */
export function ClientAppShell({ children }: { children: React.ReactNode }) {
  const state = useShopState();
  const cart = shopStore.getCart();
  const tools = getShopTools();

  useEffect(() => {
    void syncCheckoutStateToSw();
  }, [state.cart, state.shippingAddress]);

  return (
    <WebMcpProvider tools={tools} strategy="registerTool">
      <div className="app-shell">
        <header className="site-header">
          <div className="site-header-inner">
            <Link className="brand" href="/">
              Greenline Store
            </Link>
            <nav className="nav-links" aria-label="Main navigation">
              <Link className="nav-link" href="/">
                Products
              </Link>
              <Link className="nav-link" href="/cart" data-testid="nav-cart-link">
                Cart
                <span className="cart-badge" data-testid="cart-count">
                  {cart.itemCount}
                </span>
              </Link>
              <Link className="nav-link" href="/checkout" data-testid="nav-checkout-link">
                Checkout
              </Link>
              <Link className="nav-link" href="/tools" data-testid="nav-tools-link">
                Tools
              </Link>
              <span className="status-chip" data-testid="sw-ready-chip">
                SW: {isShopSwBridgeReady() ? "ready" : "warming"}
              </span>
              {state.lastOrderId ? (
                <span className="status-chip" data-testid="last-order-chip">
                  Last order: {state.lastOrderId}
                </span>
              ) : null}
            </nav>
          </div>
        </header>

        <main className="content">{children}</main>
      </div>

      <OrderConfirmationDialog />
    </WebMcpProvider>
  );
}
