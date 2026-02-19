"use client";

import { useMemo, useState } from "react";

import { formatCurrency } from "@/lib/shop-domain";
import { shopStore, useShopState } from "@/lib/shop-store";
import type { ShippingAddress } from "@/lib/types";

function initialAddress(address: ShippingAddress | null): ShippingAddress {
  if (!address) {
    return {
      name: "",
      phone: "",
      address: ""
    };
  }

  return address;
}

export default function CheckoutPage() {
  const state = useShopState();
  const [form, setForm] = useState<ShippingAddress>(() => initialAddress(state.shippingAddress));
  const [notice, setNotice] = useState<string | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  const previewResult = useMemo(() => {
    try {
      return {
        summary: shopStore.prepareCheckout(),
        error: null
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Checkout preview unavailable.";
      return {
        summary: null,
        error: message
      };
    }
  }, [state.cart, state.shippingAddress, state.orders]);

  const latestOrder = state.lastOrderId
    ? (state.orders.find((order) => order.orderId === state.lastOrderId) ?? null)
    : null;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section>
        <h1 className="page-title">Checkout</h1>
        <p className="page-subtitle">
          This page shares the same state used by WebMCP tools: cart, shipping address, and order
          status.
        </p>
      </section>

      <section className="section-card" data-testid="checkout-page">
        <h2 style={{ marginTop: 0 }}>Shipping Address</h2>
        <div style={{ display: "grid", gap: 10 }}>
          <input
            className="input"
            placeholder="Name"
            value={form.name}
            data-testid="shipping-name"
            onChange={(event) => {
              setForm((current) => ({ ...current, name: event.target.value }));
            }}
          />
          <input
            className="input"
            placeholder="Phone"
            value={form.phone}
            data-testid="shipping-phone"
            onChange={(event) => {
              setForm((current) => ({ ...current, phone: event.target.value }));
            }}
          />
          <textarea
            className="textarea"
            placeholder="Address"
            value={form.address}
            data-testid="shipping-address"
            onChange={(event) => {
              setForm((current) => ({ ...current, address: event.target.value }));
            }}
          />
          <div className="button-row">
            <button
              className="button button-primary"
              type="button"
              data-testid="save-address-button"
              onClick={() => {
                shopStore.setShippingAddress(form);
                setNotice("Shipping address saved.");
              }}
            >
              Save Address
            </button>
          </div>
        </div>
      </section>

      <section className="section-card">
        <h2 style={{ marginTop: 0 }}>Order Preview</h2>
        {previewResult.error ? (
          <p className="muted" data-testid="checkout-error">
            {previewResult.error}
          </p>
        ) : null}

        {previewResult.summary ? (
          <>
            <div className="summary" data-testid="checkout-summary">
              <div className="summary-row">
                <span>Items</span>
                <strong>{previewResult.summary.itemCount}</strong>
              </div>
              <div className="summary-row">
                <span>Subtotal</span>
                <strong>{formatCurrency(previewResult.summary.subtotal)}</strong>
              </div>
              <div className="summary-row">
                <span>Shipping</span>
                <strong>{formatCurrency(previewResult.summary.shippingFee)}</strong>
              </div>
              <div className="summary-row">
                <span>Tax</span>
                <strong>{formatCurrency(previewResult.summary.tax)}</strong>
              </div>
              <div className="summary-row summary-total">
                <span>Total</span>
                <strong>{formatCurrency(previewResult.summary.total)}</strong>
              </div>
            </div>

            <div className="button-row" style={{ marginTop: 14 }}>
              <button
                className="button button-primary"
                type="button"
                disabled={isPlacingOrder}
                data-testid="manual-place-order"
                onClick={async () => {
                  try {
                    setIsPlacingOrder(true);
                    const summary = shopStore.prepareCheckout();
                    const confirmed = await shopStore.requestOrderConfirmation(summary);
                    if (!confirmed) {
                      setNotice("Order cancelled by user.");
                      return;
                    }

                    const order = shopStore.placeOrder();
                    setNotice(`Order ${order.orderId} confirmed.`);
                  } catch (error) {
                    const message =
                      error instanceof Error ? error.message : "Could not complete the order.";
                    setNotice(message);
                  } finally {
                    setIsPlacingOrder(false);
                  }
                }}
              >
                {isPlacingOrder ? "Waiting for confirmation..." : "Place Order"}
              </button>
            </div>
          </>
        ) : null}
      </section>

      {notice ? <p className="muted">{notice}</p> : null}

      {latestOrder ? (
        <section className="section-card" data-testid="order-result">
          <h2 style={{ marginTop: 0 }}>Latest Order</h2>
          <p>
            Order ID: <strong data-testid="order-id">{latestOrder.orderId}</strong>
          </p>
          <p>
            Status: <span className="status-chip">{latestOrder.status}</span>
          </p>
          <p className="muted">Updated: {new Date(latestOrder.updatedAt).toLocaleString()}</p>
        </section>
      ) : null}
    </div>
  );
}
