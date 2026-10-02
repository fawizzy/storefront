import Link from "next/link";
import { requireUser } from "@/lib/session";
import { db, type Order, type OrderItem } from "@/lib/db";
import { formatMoney } from "@/lib/config";
import { StatusBadge } from "@/components/StatusBadge";

export const metadata = { title: "My orders" };

export default async function OrdersPage() {
  const user = await requireUser("/orders");
  const orders = db
    .prepare("SELECT * FROM orders WHERE email = ? AND payment_status != 'failed' ORDER BY id DESC")
    .all(user.email!.toLowerCase()) as Order[];
  const itemsFor = db.prepare("SELECT * FROM order_items WHERE order_id = ?");

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">My orders</h1>
      {orders.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-line p-10 text-center">
          <p className="text-muted">You haven&apos;t placed an order yet.</p>
          <Link href="/" className="btn btn-primary mt-4">
            Browse the shop
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {orders.map((o) => {
            const items = itemsFor.all(o.id) as OrderItem[];
            return (
              <li key={o.id} className="rounded-lg border border-line bg-surface p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-semibold">Order #{o.id}</h2>
                  <span className="text-sm text-muted">{new Date(o.created_at + "Z").toLocaleDateString("en-NG", { dateStyle: "medium" })}</span>
                  <span className="ml-auto flex gap-2">
                    <StatusBadge status={o.payment_status} />
                    {o.payment_status === "paid" && <StatusBadge status={o.fulfillment_status} />}
                  </span>
                </div>
                <ul className="mt-3 text-sm text-muted">
                  {items.map((i) => (
                    <li key={i.id}>
                      {i.name} × {i.quantity}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 font-semibold tabular-nums">{formatMoney(o.total, o.currency)}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
