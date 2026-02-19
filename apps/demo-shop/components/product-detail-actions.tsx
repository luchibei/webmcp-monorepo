"use client";

import { useState } from "react";

import { shopStore } from "@/lib/shop-store";

/**
 * Client actions for product detail page.
 */
export function ProductDetailActions({ productId }: { productId: string }) {
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="button-row" style={{ alignItems: "center" }}>
      <input
        className="input"
        aria-label="Quantity"
        min={1}
        max={20}
        type="number"
        value={quantity}
        onChange={(event) => {
          const next = Number(event.target.value);
          setQuantity(Number.isFinite(next) && next > 0 ? next : 1);
        }}
      />
      <button
        className="button button-primary"
        type="button"
        data-testid="detail-add-to-cart"
        onClick={() => {
          try {
            shopStore.addToCart(productId, quantity);
            setNotice("Added to cart.");
          } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to add product.";
            setNotice(message);
          }
        }}
      >
        Add to Cart
      </button>
      {notice ? <p className="muted">{notice}</p> : null}
    </div>
  );
}
