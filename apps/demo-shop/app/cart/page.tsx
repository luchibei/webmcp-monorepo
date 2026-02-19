"use client";

import Link from "next/link";

import { formatCurrency } from "@/lib/shop-domain";
import { shopStore, useShopState } from "@/lib/shop-store";

export default function CartPage() {
  useShopState();
  const cart = shopStore.getCart();

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section>
        <h1 className="page-title">Your Cart</h1>
        <p className="page-subtitle">Review items before moving to checkout.</p>
      </section>

      <section className="section-card" data-testid="cart-page">
        {cart.items.length === 0 ? (
          <div style={{ display: "grid", gap: 12 }}>
            <p className="muted">Your cart is empty.</p>
            <Link className="button button-primary" href="/" style={{ width: "fit-content" }}>
              Browse Products
            </Link>
          </div>
        ) : (
          <>
            <table className="cart-table" data-testid="cart-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Line Total</th>
                </tr>
              </thead>
              <tbody>
                {cart.items.map((item) => (
                  <tr key={item.productId} data-testid={`cart-item-${item.productId}`}>
                    <td>{item.name}</td>
                    <td>{item.quantity}</td>
                    <td>{formatCurrency(item.price)}</td>
                    <td>{formatCurrency(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="summary" style={{ marginTop: 14, maxWidth: 360, marginLeft: "auto" }}>
              <div className="summary-row">
                <span>Items</span>
                <strong>{cart.itemCount}</strong>
              </div>
              <div className="summary-row summary-total">
                <span>Subtotal</span>
                <strong>{formatCurrency(cart.subtotal)}</strong>
              </div>
            </div>

            <div className="button-row" style={{ justifyContent: "flex-end", marginTop: 14 }}>
              <Link className="button button-secondary" href="/">
                Continue Shopping
              </Link>
              <Link className="button button-primary" href="/checkout" data-testid="go-checkout">
                Proceed to Checkout
              </Link>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
