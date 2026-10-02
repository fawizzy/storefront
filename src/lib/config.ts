export const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME || "Kòkó Market";
export const CURRENCY = process.env.NEXT_PUBLIC_STORE_CURRENCY || "NGN";
/** Flat shipping fee in minor units (kobo). */
export const SHIPPING_FEE = Number(process.env.SHIPPING_FEE_KOBO ?? 150000);
export const LOW_STOCK_THRESHOLD = 5;
/** Lets the browser that started a guest checkout see that order on /checkout/verify. */
export const GUEST_ORDER_COOKIE = "guest_order";

export function formatMoney(minor: number, currency = CURRENCY) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
}
