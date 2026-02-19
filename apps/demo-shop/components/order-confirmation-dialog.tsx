"use client";

import { formatCurrency } from "@/lib/shop-domain";
import { shopStore, useShopState } from "@/lib/shop-store";

/**
 * Global confirmation modal consumed by `placeOrder` tool interaction.
 */
export function OrderConfirmationDialog() {
  const { pendingConfirmation } = useShopState();

  if (!pendingConfirmation) {
    return null;
  }

  const summary = pendingConfirmation.summary;

  return (
    <div className="modal-overlay" data-testid="order-confirm-dialog">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <h3 id="confirm-title">{pendingConfirmation.title}</h3>
        <p className="muted">{pendingConfirmation.message}</p>

        <div className="summary" style={{ marginTop: 14 }}>
          <div className="summary-row">
            <span>Items</span>
            <strong>{summary.itemCount}</strong>
          </div>
          <div className="summary-row">
            <span>Subtotal</span>
            <strong>{formatCurrency(summary.subtotal)}</strong>
          </div>
          <div className="summary-row">
            <span>Shipping</span>
            <strong>{formatCurrency(summary.shippingFee)}</strong>
          </div>
          <div className="summary-row">
            <span>Tax</span>
            <strong>{formatCurrency(summary.tax)}</strong>
          </div>
          <div className="summary-row summary-total">
            <span>Total</span>
            <strong>{formatCurrency(summary.total)}</strong>
          </div>
        </div>

        <div className="button-row" style={{ marginTop: 18 }}>
          <button
            className="button button-danger"
            type="button"
            data-testid="cancel-order-button"
            onClick={() => {
              shopStore.resolveOrderConfirmation(false);
            }}
          >
            Cancel
          </button>
          <button
            className="button button-primary"
            type="button"
            data-testid="confirm-order-button"
            onClick={() => {
              shopStore.resolveOrderConfirmation(true);
            }}
          >
            Confirm Order
          </button>
        </div>
      </div>
    </div>
  );
}
