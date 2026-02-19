import type {
  CartLine,
  CartSnapshot,
  CheckoutSummary,
  Product,
  ProductSearchFilters,
  ShippingAddress
} from "./types";

const DEFAULT_SEARCH_LIMIT = 8;
const FREE_SHIPPING_THRESHOLD = 300;
const STANDARD_SHIPPING_FEE = 12;
const TAX_RATE = 0.08;

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function includesQuery(product: Product, query: string): boolean {
  if (!query.trim()) {
    return true;
  }

  const normalizedQuery = query.toLowerCase();
  return (
    product.name.toLowerCase().includes(normalizedQuery) ||
    product.description.toLowerCase().includes(normalizedQuery)
  );
}

function matchesFilters(product: Product, filters?: ProductSearchFilters): boolean {
  if (!filters) {
    return true;
  }

  if (filters.category && product.category !== filters.category) {
    return false;
  }

  if (filters.minPrice !== undefined && product.price < filters.minPrice) {
    return false;
  }

  if (filters.maxPrice !== undefined && product.price > filters.maxPrice) {
    return false;
  }

  if (filters.inStockOnly && product.stock <= 0) {
    return false;
  }

  return true;
}

/**
 * Filters and ranks products by query and optional filters.
 */
export function searchProductsInCatalog(args: {
  products: Product[];
  q: string;
  limit?: number;
  filters?: ProductSearchFilters;
}): Product[] {
  const limit = args.limit ?? DEFAULT_SEARCH_LIMIT;

  return args.products
    .filter((product) => includesQuery(product, args.q) && matchesFilters(product, args.filters))
    .sort((a, b) => {
      const ratingDelta = b.rating - a.rating;
      if (ratingDelta !== 0) {
        return ratingDelta;
      }

      return a.price - b.price;
    })
    .slice(0, Math.max(1, limit));
}

/**
 * Builds line items from cart map and product catalog.
 */
export function buildCartLines(products: Product[], cart: Record<string, number>): CartLine[] {
  const productById = new Map(products.map((product) => [product.id, product]));

  return Object.entries(cart)
    .map(([productId, quantity]) => {
      const product = productById.get(productId);

      if (!product || quantity <= 0) {
        return null;
      }

      const safeQuantity = Math.min(quantity, product.stock);
      return {
        productId,
        name: product.name,
        price: product.price,
        quantity: safeQuantity,
        lineTotal: roundCurrency(product.price * safeQuantity)
      } satisfies CartLine;
    })
    .filter((line): line is CartLine => line !== null);
}

/**
 * Creates a cart snapshot with totals.
 */
export function createCartSnapshot(lines: CartLine[]): CartSnapshot {
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = roundCurrency(lines.reduce((sum, line) => sum + line.lineTotal, 0));

  return {
    items: lines,
    itemCount,
    subtotal
  };
}

/**
 * Computes checkout amount breakdown.
 */
export function createCheckoutSummary(args: {
  cart: CartSnapshot;
  shippingAddress: ShippingAddress;
}): CheckoutSummary {
  const shippingFee = args.cart.subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_FEE;
  const tax = roundCurrency(args.cart.subtotal * TAX_RATE);
  const total = roundCurrency(args.cart.subtotal + shippingFee + tax);

  return {
    items: args.cart.items,
    itemCount: args.cart.itemCount,
    subtotal: args.cart.subtotal,
    shippingFee,
    tax,
    total,
    shippingAddress: args.shippingAddress
  };
}

/**
 * Formats numbers as USD prices.
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(value);
}
