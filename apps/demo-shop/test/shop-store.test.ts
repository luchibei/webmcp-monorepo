import { describe, expect, it } from "vitest";

import { createShopStore } from "../lib/shop-store";

describe("shop store domain", () => {
  it("searches products with query and limit", () => {
    const store = createShopStore();

    const result = store.searchProducts({ q: "smart", limit: 1 });

    expect(result.length).toBe(1);
    expect(`${result[0]?.name} ${result[0]?.description}`.toLowerCase()).toContain("smart");
  });

  it("adds products to cart and returns summary", () => {
    const store = createShopStore();

    const snapshot = store.addToCart("p-aurora-headphones", 2);

    expect(snapshot.itemCount).toBe(2);
    expect(snapshot.items[0]?.productId).toBe("p-aurora-headphones");
    expect(snapshot.subtotal).toBeGreaterThan(0);
  });

  it("fails checkout preparation when shipping address is missing", () => {
    const store = createShopStore();
    store.addToCart("p-aurora-headphones", 1);

    expect(() => store.prepareCheckout()).toThrowError(/shipping address/i);
  });

  it("prepares checkout with totals after shipping is set", () => {
    const store = createShopStore();
    store.addToCart("p-aurora-headphones", 1);
    store.setShippingAddress({
      name: "Avery Kim",
      phone: "555-1200",
      address: "500 Market St, San Francisco"
    });

    const summary = store.prepareCheckout();

    expect(summary.itemCount).toBe(1);
    expect(summary.subtotal).toBeGreaterThan(0);
    expect(summary.total).toBeGreaterThan(summary.subtotal);
    expect(summary.shippingAddress.name).toBe("Avery Kim");
  });

  it("places order, clears cart, and exposes order status", () => {
    const store = createShopStore();
    store.addToCart("p-aurora-headphones", 1);
    store.setShippingAddress({
      name: "Jordan Lane",
      phone: "555-9988",
      address: "101 King Street"
    });

    const order = store.placeOrder();
    const cart = store.getCart();
    const status = store.getOrderStatus(order.orderId);

    expect(order.status).toBe("confirmed");
    expect(cart.itemCount).toBe(0);
    expect(status?.orderId).toBe(order.orderId);
  });
});
