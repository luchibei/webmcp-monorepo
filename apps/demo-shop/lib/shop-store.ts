import { useSyncExternalStore } from "react";

import { MOCK_PRODUCTS } from "./products";
import {
  buildCartLines,
  createCartSnapshot,
  createCheckoutSummary,
  searchProductsInCatalog
} from "./shop-domain";
import type {
  CartSnapshot,
  CheckoutSummary,
  Order,
  PendingOrderConfirmation,
  Product,
  ProductSearchFilters,
  ShippingAddress,
  ShopState
} from "./types";

interface SearchArgs {
  q: string;
  limit?: number;
  filters?: ProductSearchFilters;
}

type Listener = () => void;

function createInitialState(products: Product[]): ShopState {
  return {
    products,
    cart: {},
    shippingAddress: null,
    orders: [],
    pendingConfirmation: null,
    lastOrderId: null
  };
}

/**
 * Shared shop state container used by UI and tool executors.
 */
export class ShopStore {
  private state: ShopState;
  private listeners: Set<Listener>;
  private confirmationResolver: ((value: boolean) => void) | null;

  constructor(products: Product[] = MOCK_PRODUCTS) {
    this.state = createInitialState(products);
    this.listeners = new Set();
    this.confirmationResolver = null;
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = (): ShopState => {
    return this.state;
  };

  private setState(nextState: ShopState): void {
    this.state = nextState;
    this.listeners.forEach((listener) => listener());
  }

  reset(): void {
    this.setState(createInitialState(this.state.products));
    this.confirmationResolver = null;
  }

  searchProducts(args: SearchArgs): Product[] {
    const searchArgs = {
      products: this.state.products,
      q: args.q,
      ...(args.limit !== undefined ? { limit: args.limit } : {}),
      ...(args.filters !== undefined ? { filters: args.filters } : {})
    };

    return searchProductsInCatalog({
      ...searchArgs
    });
  }

  getProduct(id: string): Product | null {
    return this.state.products.find((product) => product.id === id) ?? null;
  }

  addToCart(productId: string, quantity: number): CartSnapshot {
    if (quantity <= 0) {
      throw new Error("Quantity must be a positive number.");
    }

    const product = this.getProduct(productId);
    if (!product) {
      throw new Error(`Product "${productId}" does not exist.`);
    }

    const currentQuantity = this.state.cart[productId] ?? 0;
    const nextQuantity = Math.min(product.stock, currentQuantity + quantity);

    this.setState({
      ...this.state,
      cart: {
        ...this.state.cart,
        [productId]: nextQuantity
      }
    });

    return this.getCart();
  }

  getCart(): CartSnapshot {
    const lines = buildCartLines(this.state.products, this.state.cart);
    return createCartSnapshot(lines);
  }

  setShippingAddress(address: ShippingAddress): ShippingAddress {
    this.setState({
      ...this.state,
      shippingAddress: address
    });

    return address;
  }

  prepareCheckout(): CheckoutSummary {
    const cart = this.getCart();

    if (cart.itemCount === 0) {
      throw new Error("Cart is empty. Add products before checkout.");
    }

    if (!this.state.shippingAddress) {
      throw new Error("Shipping address is required before checkout.");
    }

    return createCheckoutSummary({
      cart,
      shippingAddress: this.state.shippingAddress
    });
  }

  async requestOrderConfirmation(summary: CheckoutSummary): Promise<boolean> {
    const request: PendingOrderConfirmation = {
      requestId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: "Confirm your order",
      message: "This is a payment action. Please review your order details before submitting.",
      summary
    };

    this.setState({
      ...this.state,
      pendingConfirmation: request
    });

    return new Promise<boolean>((resolve) => {
      this.confirmationResolver = resolve;
    });
  }

  resolveOrderConfirmation(confirmed: boolean): void {
    const resolver = this.confirmationResolver;
    this.confirmationResolver = null;

    this.setState({
      ...this.state,
      pendingConfirmation: null
    });

    resolver?.(confirmed);
  }

  placeOrder(): Order {
    const summary = this.prepareCheckout();

    const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;
    const timestamp = new Date().toISOString();

    const order: Order = {
      orderId,
      status: "confirmed",
      createdAt: timestamp,
      updatedAt: timestamp,
      summary
    };

    this.setState({
      ...this.state,
      cart: {},
      orders: [order, ...this.state.orders],
      lastOrderId: orderId,
      pendingConfirmation: null
    });

    this.confirmationResolver = null;
    return order;
  }

  getOrderStatus(
    orderId: string
  ): { orderId: string; status: Order["status"]; updatedAt: string } | null {
    const order = this.state.orders.find((item) => item.orderId === orderId);
    if (!order) {
      return null;
    }

    return {
      orderId: order.orderId,
      status: order.status,
      updatedAt: order.updatedAt
    };
  }
}

/**
 * Creates an isolated store instance.
 */
export function createShopStore(products: Product[] = MOCK_PRODUCTS): ShopStore {
  return new ShopStore(products);
}

export const shopStore = createShopStore();

/**
 * React subscription hook for the singleton store.
 */
export function useShopState(): ShopState {
  return useSyncExternalStore(shopStore.subscribe, shopStore.getState, shopStore.getState);
}
