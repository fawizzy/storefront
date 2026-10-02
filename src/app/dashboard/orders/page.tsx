import Link from "next/link";
import { db, type Order } from "@/lib/db";
import { formatMoney } from "@/lib/config";
import { StatusBadge } from "@/components/StatusBadge";

export const metadata = { title: "Orders" };

const FILTERS = {
  "to-ship": { label: "To ship", where: "payment_status = 'paid' AND fulfillment_status IN ('unfulfilled','processing')" },
  paid: { label: "All paid", where: "payment_status = 'paid'" },
  pending: { label: "Awaiting payment", where: "payment_status = 'pending'" },
  failed: { label: "Failed", where: "payment_status = 'failed'" },
} as const;
type FilterKey = keyof typeof FILTERS;

export default async function OrdersPage({ searchParams }: PageProps<"/dashboard/orders">) {
  const { status } = await searchParams;
  const key: FilterKey = typeof status === "string" && status in FILTERS ? (status as FilterKey) : "paid";
  const orders = db
    .prepare(`SELECT * FROM orders WHERE ${FILTERS[key].where} ORDER BY id DESC LIMIT 200`)
    .all() as Order[];

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">Orders</h1>

      <nav aria-label="Filter orders" className="mt-6 flex flex-wrap gap-2">
        {(Object.keys(FILTERS) as FilterKey[]).map((k) => (
          <Link
            key={k}
            href={`/dashboard/orders?status=${k}`}
            aria-current={k === key ? "page" : undefined}
            className={`rounded-full border px-4 py-1.5 text-sm ${
              k === key ? "border-indigo bg-indigo text-white" : "border-line bg-surface hover:border-ink"
            }`}
          >
            {FILTERS[k].label}
          </Link>
        ))}
      </nav>

      <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="p-3 font-medium">Order</th>
              <th className="p-3 font-medium">Placed</th>
              <th className="p-3 font-medium">Customer</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="p-3">
                  <Link href={`/dashboard/orders/${o.id}`} className="font-medium text-indigo hover:underline">
                    #{o.id}
                  </Link>
                </td>
                <td className="p-3 text-muted">
                  {new Date(o.created_at + "Z").toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}
                </td>
                <td className="p-3">
                  <div>{o.customer_name}</div>
                  <div className="text-muted">{o.city}</div>
                </td>
                <td className="p-3">
                  <StatusBadge status={o.payment_status === "paid" ? o.fulfillment_status : o.payment_status} />
                </td>
                <td className="p-3 text-right tabular-nums">{formatMoney(o.total, o.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && <p className="p-6 text-center text-muted">No orders match this filter.</p>}
      </div>
    </div>
  );
}
