import "server-only";
import crypto from "node:crypto";
import { headers } from "next/headers";
import { db, type Product } from "@/lib/db";
import { CURRENCY, SHIPPING_FEE } from "@/lib/config";
import { initializeTransaction } from "@/lib/paystack";

export type CheckoutInput = {
  items: { productId: number; quantity: number }[];
  email?: string; // guests only; signed-in customers use their account email
  name: string;
  phone: string;
  address: string;
  city: string;
};

export type CheckoutResult = { url: string; reference: string } | { error: string };

export async function appUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

/**
 * Prices the cart from the database, creates a pending order and opens a Paystack
 * transaction. `userEmail` is set when the customer is signed in.
 */
export async function createCheckout(
  input: Partial<CheckoutInput>,
  userEmail: string | null,
  callbackUrl: string,
): Promise<CheckoutResult> {
  const email = (userEmail ?? input.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email for your receipt." };

  const name = input.name?.trim();
  const phone = input.phone?.trim();
  const address = input.address?.trim();
  const city = input.city?.trim();
  if (!name || !phone || !address || !city) return { error: "Fill in every delivery field." };

  // Merge duplicate lines and validate quantities.
  const wanted = new Map<number, number>();
  for (const item of input.items ?? []) {
    const qty = Math.floor(Number(item.quantity));
    if (!Number.isInteger(item.productId) || qty < 1 || qty > 99) return { error: "Your cart has an invalid item." };
    wanted.set(item.productId, (wanted.get(item.productId) ?? 0) + qty);
  }
  if (wanted.size === 0) return { error: "Your cart is empty." };

  // Prices always come from the database, never from the client.
  const lines: { product: Product; quantity: number }[] = [];
  for (const [productId, quantity] of wanted) {
    const product = await db.get<Product>("SELECT * FROM products WHERE id = ? AND active = 1", productId);
    if (!product) return { error: "An item in your cart is no longer available. Remove it and try again." };
    if (product.stock < quantity) {
      return {
        error:
          product.stock === 0
            ? `${product.name} just sold out. Remove it to continue.`
            : `Only ${product.stock} of ${product.name} left. Lower the quantity to continue.`,
      };
    }
    lines.push({ product, quantity });
  }

  const subtotal = lines.reduce((sum, l) => sum + l.product.price * l.quantity, 0);
  const total = subtotal + SHIPPING_FEE;
  // Only link the order to an account when the customer is signed in as that account.
  const userRow = userEmail ? await db.get<{ id: number }>("SELECT id FROM users WHERE email = ?", email) : undefined;
  const reference = `ord_${Date.now().toString(36)}_${crypto.randomBytes(6).toString("hex")}`;

  const orderId = await db.transaction(async (tx) => {
    const { lastInsertRowid } = await tx.run(
      `INSERT INTO orders (reference, user_id, email, customer_name, phone, address, city,
                           subtotal, shipping, total, currency)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      reference, userRow?.id ?? null, email, name, phone, address, city, subtotal, SHIPPING_FEE, total, CURRENCY,
    );
    for (const l of lines) {
      await tx.run(
        "INSERT INTO order_items (order_id, product_id, name, unit_price, quantity) VALUES (?, ?, ?, ?, ?)",
        lastInsertRowid, l.product.id, l.product.name, l.product.price, l.quantity,
      );
    }
    return lastInsertRowid;
  });

  try {
    const tx = await initializeTransaction({
      email,
      amount: total,
      currency: CURRENCY,
      reference,
      callbackUrl,
      metadata: { order_id: orderId },
    });
    return { url: tx.authorization_url, reference };
  } catch (err) {
    console.error(err);
    await db.run("UPDATE orders SET payment_status = 'failed' WHERE id = ?", orderId);
    return { error: "We couldn't reach Paystack. Try again in a moment." };
  }
}

/** Delivery details from a customer's most recent order, to prefill checkout. */
export async function lastDeliveryDetails(email: string) {
  return db.get<{ customer_name: string; phone: string; address: string; city: string }>(
    "SELECT customer_name, phone, address, city FROM orders WHERE email = ? ORDER BY id DESC LIMIT 1",
    email.toLowerCase(),
  );
}
