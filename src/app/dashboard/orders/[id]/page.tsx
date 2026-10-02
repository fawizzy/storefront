import Link from "next/link";
import { notFound } from "next/navigation";
import { db, FULFILLMENT_STATUSES, type Order, type OrderItem } from "@/lib/db";
import { formatMoney } from "@/lib/config";
import { StatusBadge } from "@/components/StatusBadge";
import { setFulfillment } from "../../actions";

export const metadata = { title: "Order" };

const LABELS: Record<string, string> = {
  unfulfilled: "Not started",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default async function OrderPage({ params }: PageProps<"/dashboard/orders/[id]">) {
  const id = Number((await params).id);
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as Order | undefined;
  if (!order) notFound();
  const items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(id) as OrderItem[];

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/dashboard/orders" className="text-sm text-muted hover:underline">
        All orders
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Order #{order.id}</h1>
        <StatusBadge status={order.payment_status} />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_280px]">
        <section className="rounded-lg border border-line bg-surface">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line">
              {items.map((i) => (
                <tr key={i.id}>
                  <td className="p-3">{i.name}</td>
                  <td className="p-3 text-right text-muted tabular-nums">
                    {formatMoney(i.unit_price, order.currency)} × {i.quantity}
                  </td>
                  <td className="p-3 text-right tabular-nums">{formatMoney(i.unit_price * i.quantity, order.currency)}</td>
                </tr>
              ))}
              <tr>
                <td className="p-3 text-muted" colSpan={2}>Shipping</td>
                <td className="p-3 text-right tabular-nums">{formatMoney(order.shipping, order.currency)}</td>
              </tr>
              <tr className="font-bold">
                <td className="p-3" colSpan={2}>Total</td>
                <td className="p-3 text-right tabular-nums">{formatMoney(order.total, order.currency)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <div className="space-y-6">
          <section className="rounded-lg border border-line bg-surface p-4 text-sm">
            <h2 className="font-semibold">Deliver to</h2>
            <p className="mt-2">{order.customer_name}</p>
            <p className="text-muted">{order.address}</p>
            <p className="text-muted">{order.city}</p>
            <p className="mt-2">
              <a href={`tel:${order.phone}`} className="text-indigo hover:underline">{order.phone}</a>
            </p>
            <p>
              <a href={`mailto:${order.email}`} className="text-indigo hover:underline">{order.email}</a>
            </p>
          </section>

          {order.payment_status === "paid" && (
            <form key={order.fulfillment_status} action={setFulfillment.bind(null, order.id)} className="rounded-lg border border-line bg-surface p-4 text-sm">
              <label className="grid gap-2">
                <span className="font-semibold">Fulfillment</span>
                <select name="status" defaultValue={order.fulfillment_status} className="field">
                  {FULFILLMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>{LABELS[s]}</option>
                  ))}
                </select>
              </label>
              <button className="btn btn-primary mt-3 w-full">Update status</button>
            </form>
          )}

          <section className="rounded-lg border border-line bg-surface p-4 text-sm text-muted">
            <h2 className="font-semibold text-ink">Payment</h2>
            <p className="mt-2 break-all">Reference: {order.reference}</p>
            {order.paystack_id && <p>Paystack ID: {order.paystack_id}</p>}
            {order.paid_at && (
              <p>Paid {new Date(order.paid_at + "Z").toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
