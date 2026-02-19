/// <reference lib="webworker" />

import { fail } from "@luchibei/webmcp-sdk";
import { createSwRouter } from "@luchibei/webmcp-sw-runtime";
import { z } from "zod";

const FREE_SHIPPING_THRESHOLD = 300;
const STANDARD_SHIPPING_FEE = 12;
const TAX_RATE = 0.08;

const shippingAddressSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(6),
  address: z.string().min(6)
});

const cartLineSchema = z.object({
  productId: z.string(),
  name: z.string(),
  price: z.number(),
  quantity: z.number().int().positive(),
  lineTotal: z.number()
});

const syncStateSchema = z.object({
  cart: z.object({
    items: z.array(cartLineSchema),
    itemCount: z.number().int().nonnegative(),
    subtotal: z.number().nonnegative()
  }),
  shippingAddress: shippingAddressSchema.nullable()
});

type SyncedCheckoutState = z.infer<typeof syncStateSchema>;

let latestCheckoutState: SyncedCheckoutState | null = null;

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

const router = createSwRouter({
  __syncCheckoutState: {
    input: syncStateSchema,
    execute: async (input) => {
      latestCheckoutState = input;
      return {
        synced: true,
        itemCount: input.cart.itemCount
      };
    }
  },
  prepareCheckout: {
    input: z.object({}),
    execute: async () => {
      if (!latestCheckoutState) {
        return fail("CHECKOUT_CONTEXT_MISSING", "Checkout context has not been synced to SW yet.");
      }

      if (latestCheckoutState.cart.itemCount === 0) {
        return fail("CHECKOUT_PREPARATION_FAILED", "Cart is empty. Add products before checkout.");
      }

      if (!latestCheckoutState.shippingAddress) {
        return fail("CHECKOUT_PREPARATION_FAILED", "Shipping address is required before checkout.");
      }

      const subtotal = latestCheckoutState.cart.subtotal;
      const shippingFee = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_FEE;
      const tax = roundCurrency(subtotal * TAX_RATE);
      const total = roundCurrency(subtotal + shippingFee + tax);

      return {
        preparedBy: "service-worker",
        items: latestCheckoutState.cart.items,
        itemCount: latestCheckoutState.cart.itemCount,
        subtotal,
        shippingFee,
        tax,
        total,
        shippingAddress: latestCheckoutState.shippingAddress
      };
    }
  }
});

const swGlobal = self as unknown as ServiceWorkerGlobalScope;

swGlobal.addEventListener("install", () => {
  swGlobal.skipWaiting();
});

swGlobal.addEventListener("activate", (event) => {
  event.waitUntil(swGlobal.clients.claim());
});

void router;
