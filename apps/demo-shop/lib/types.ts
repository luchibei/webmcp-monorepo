export interface Product {
  id: string;
  name: string;
  description: string;
  category: "audio" | "home" | "wearable" | "productivity" | "gaming";
  price: number;
  stock: number;
  rating: number;
  image: string;
}

export interface ProductSearchFilters {
  category?: Product["category"];
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
}

export interface CartLine {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  lineTotal: number;
}

export interface ShippingAddress {
  name: string;
  phone: string;
  address: string;
}

export interface CartSnapshot {
  items: CartLine[];
  itemCount: number;
  subtotal: number;
}

export interface CheckoutSummary {
  items: CartLine[];
  itemCount: number;
  subtotal: number;
  shippingFee: number;
  tax: number;
  total: number;
  shippingAddress: ShippingAddress;
}

export type OrderStatus = "confirmed" | "processing" | "shipped";

export interface Order {
  orderId: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  summary: CheckoutSummary;
}

export interface PendingOrderConfirmation {
  requestId: string;
  title: string;
  message: string;
  summary: CheckoutSummary;
}

export interface ShopState {
  products: Product[];
  cart: Record<string, number>;
  shippingAddress: ShippingAddress | null;
  orders: Order[];
  pendingConfirmation: PendingOrderConfirmation | null;
  lastOrderId: string | null;
}
