"use server";

import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { auth } from "@/auth";
import { db, type Product } from "@/lib/db";
import { CURRENCY, GUEST_ORDER_COOKIE, SHIPPING_FEE } from "@/lib/config";
import { initializeTransaction } from "@/lib/paystack";

export type CheckoutInput = {
  items: { productId: number; quantity: number }[];
  email?: string; // guests only; signed-in customers use their Google email
  name: string;
  phone: string;
  address: string;
  city: string;
};

export type CheckoutResult = { url: string } | { error: string };

async function appUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function startCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  const session = await auth();
  const user = session?.user;
  const email = (user?.email ?? input.email ?? "").trim().toLowerCase();
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

  // Prices always come from the database, never from the browser.
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
  const userRow = user?.email
    ? await db.get<{ id: number }>("SELECT id FROM users WHERE email = ?", email)
    : undefined;
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
      callbackUrl: `${await appUrl()}/checkout/verify`,
      metadata: { order_id: orderId },
    });
    if (!user?.email) {
      (await cookies()).set(GUEST_ORDER_COOKIE, reference, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/checkout",
        maxAge: 60 * 60 * 24,
      });
    }
    return { url: tx.authorization_url };
  } catch (err) {
    console.error(err);
    await db.run("UPDATE orders SET payment_status = 'failed' WHERE id = ?", orderId);
    return { error: "We couldn't reach Paystack. Try again in a moment." };
  }
}
