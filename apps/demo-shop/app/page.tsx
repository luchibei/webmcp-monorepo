"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { formatCurrency, searchProductsInCatalog } from "@/lib/shop-domain";
import { shopStore, useShopState } from "@/lib/shop-store";

export default function HomePage() {
  const state = useShopState();
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const products = useMemo(() => {
    return searchProductsInCatalog({
      products: state.products,
      q: query,
      limit: 20
    });
  }, [state.products, query]);

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <section>
        <h1 className="page-title">Macro-tool-first shopping demo</h1>
        <p className="page-subtitle">
          This store exposes high-level WebMCP tools so browser agents can finish purchase flows in
          2-4 calls instead of brittle click automation.
        </p>
      </section>

      <section className="section-card">
        <div className="controls-row">
          <input
            className="input"
            style={{ flex: 1, minWidth: 240 }}
            placeholder="Search products (e.g. headphones, monitor)"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            data-testid="product-search-input"
          />
        </div>
        {notice ? <p className="muted">{notice}</p> : null}

        <div className="product-grid">
          {products.map((product) => (
            <article
              key={product.id}
              className="product-card"
              data-testid={`product-card-${product.id}`}
            >
              <div className="product-emoji">{product.image}</div>
              <h2 className="product-name">{product.name}</h2>
              <p className="muted">{product.description}</p>
              <p className="muted">
                Category: {product.category} · Rating: {product.rating}
              </p>
              <div className="price">{formatCurrency(product.price)}</div>
              <div className="button-row">
                <button
                  className="button button-primary"
                  type="button"
                  data-testid={`add-to-cart-${product.id}`}
                  onClick={() => {
                    try {
                      const cart = shopStore.addToCart(product.id, 1);
                      setNotice(`Added ${product.name}. Cart now has ${cart.itemCount} items.`);
                    } catch (error) {
                      const message =
                        error instanceof Error
                          ? error.message
                          : "Could not add this product to cart.";
                      setNotice(message);
                    }
                  }}
                >
                  Add to Cart
                </button>
                <Link className="button button-secondary" href={`/products/${product.id}`}>
                  Details
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
