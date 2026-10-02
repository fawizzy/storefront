import "server-only";
import crypto from "node:crypto";
import { db, type Order } from "@/lib/db";

const API = "https://api.paystack.co";

function secretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not set");
  return key;
}

async function paystack<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.status) {
    throw new Error(`Paystack ${path} failed: ${body?.message ?? res.statusText}`);
  }
  return body.data as T;
}

export function initializeTransaction(args: {
  email: string;
  amount: number; // minor units
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}) {
  return paystack<{ authorization_url: string; access_code: string; reference: string }>(
    "/transaction/initialize",
    {
      method: "POST",
      body: JSON.stringify({
        email: args.email,
        amount: args.amount,
        currency: args.currency,
        reference: args.reference,
        callback_url: args.callbackUrl,
        metadata: args.metadata,
      }),
    },
  );
}

type VerifyData = {
  id: number;
  status: "success" | "failed" | "abandoned" | "ongoing" | "pending" | "reversed";
  reference: string;
  amount: number;
  currency: string;
  paid_at: string | null;
};

export function isValidWebhookSignature(rawBody: string, signature: string | null) {
  if (!signature) return false;
  const expected = crypto.createHmac("sha512", secretKey()).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Verifies a transaction with Paystack and, on success, marks the order paid and
 * decrements stock. Safe to call repeatedly (callback page + webhook both call it).
 */
export async function confirmPayment(reference: string): Promise<Order | null> {
  const order = db.prepare("SELECT * FROM orders WHERE reference = ?").get(reference) as
    | Order
    | undefined;
  if (!order) return null;
  if (order.payment_status === "paid") return order;

  const tx = await paystack<VerifyData>(`/transaction/verify/${encodeURIComponent(reference)}`);

  if (tx.status === "success") {
    // Never trust the client: amount and currency must match what we charged.
    if (tx.amount !== order.total || tx.currency !== order.currency) {
      console.error(`Payment mismatch for ${reference}: got ${tx.amount} ${tx.currency}`);
      db.prepare("UPDATE orders SET payment_status = 'failed' WHERE id = ?").run(order.id);
    } else {
      db.transaction(() => {
        const updated = db
          .prepare(
            `UPDATE orders SET payment_status = 'paid', paystack_id = ?, paid_at = datetime(?)
             WHERE id = ? AND payment_status != 'paid'`,
          )
          .run(String(tx.id), tx.paid_at ?? new Date().toISOString(), order.id);
        // Only the first confirmation decrements stock.
        if (updated.changes === 1) {
          db.prepare(
            `UPDATE products SET stock = MAX(0, stock - (
               SELECT COALESCE(SUM(quantity), 0) FROM order_items
               WHERE order_id = ? AND product_id = products.id))
             WHERE id IN (SELECT product_id FROM order_items WHERE order_id = ?)`,
          ).run(order.id, order.id);
        }
      })();
    }
  } else if (tx.status === "failed" || tx.status === "abandoned" || tx.status === "reversed") {
    db.prepare("UPDATE orders SET payment_status = 'failed' WHERE id = ? AND payment_status = 'pending'").run(
      order.id,
    );
  }

  return db.prepare("SELECT * FROM orders WHERE id = ?").get(order.id) as Order;
}
