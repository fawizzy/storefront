import { db, type Order, type OrderItem } from "@/lib/db";
import { getApiUser, json, unauthorized } from "@/lib/api";

/** GET /api/orders → the signed-in user's orders (excluding failed payments), newest first. */
export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();
  const orders = await db.all<Order>(
    "SELECT * FROM orders WHERE email = ? AND payment_status != 'failed' ORDER BY id DESC",
    user.email,
  );
  const items = await db.all<OrderItem>(
    `SELECT i.* FROM order_items i JOIN orders o ON o.id = i.order_id
     WHERE o.email = ? AND o.payment_status != 'failed'`,
    user.email,
  );
  return json({
    orders: orders.map((o) => ({
      id: o.id,
      reference: o.reference,
      createdAt: o.created_at,
      total: o.total,
      currency: o.currency,
      paymentStatus: o.payment_status,
      fulfillmentStatus: o.fulfillment_status,
      items: items
        .filter((i) => i.order_id === o.id)
        .map((i) => ({ name: i.name, quantity: i.quantity, unitPrice: i.unit_price })),
    })),
  });
}
