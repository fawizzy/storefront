import Link from "next/link";
import { db, type Order, type Product } from "@/lib/db";
import { CURRENCY, formatMoney, LOW_STOCK_THRESHOLD } from "@/lib/config";
import { StatusBadge } from "@/components/StatusBadge";
import { RevenueChart } from "./RevenueChart";

export const metadata = { title: "Overview" };

const DAYS = 14;

export default async function Overview() {
  const totals = (await db.get<{ revenue: number; paid: number; toShip: number; customers: number }>(
    `SELECT
         COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total END), 0) AS revenue,
         COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) AS paid,
         COUNT(CASE WHEN payment_status = 'paid' AND fulfillment_status IN ('unfulfilled','processing') THEN 1 END) AS toShip,
         COUNT(DISTINCT CASE WHEN payment_status = 'paid' THEN email END) AS customers
       FROM orders`,
  ))!;

  const rows = await db.all<{ day: string; revenue: number; orders: number }>(
    `SELECT date(paid_at) AS day, SUM(total) AS revenue, COUNT(*) AS orders
     FROM orders WHERE payment_status = 'paid' AND paid_at >= date('now', ?)
     GROUP BY day`,
    `-${DAYS - 1} days`,
  );
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const series = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - (DAYS - 1 - i));
    const day = d.toISOString().slice(0, 10);
    return { day, revenue: byDay.get(day)?.revenue ?? 0, orders: byDay.get(day)?.orders ?? 0 };
  });
  const periodRevenue = series.reduce((s, d) => s + d.revenue, 0);

  const recent = await db.all<Order>("SELECT * FROM orders WHERE payment_status != 'failed' ORDER BY id DESC LIMIT 6");
  const lowStock = await db.all<Product>(
    "SELECT * FROM products WHERE active = 1 AND stock <= ? ORDER BY stock ASC LIMIT 6",
    LOW_STOCK_THRESHOLD,
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">Overview</h1>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-4">
        <Stat label="Revenue, all time" value={formatMoney(totals.revenue)} />
        <Stat label="Paid orders" value={totals.paid.toLocaleString()} />
        <Stat label="Orders to ship" value={totals.toShip.toLocaleString()} href="/dashboard/orders?status=to-ship" />
        <Stat label="Customers" value={totals.customers.toLocaleString()} />
      </div>

      <section className="rounded-lg border border-line bg-surface p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Revenue, last {DAYS} days</h2>
          <p className="font-display text-2xl font-bold tabular-nums">{formatMoney(periodRevenue)}</p>
        </div>
        <RevenueChart data={series} currency={CURRENCY} />
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <section className="rounded-lg border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line p-4">
            <h2 className="font-semibold">Recent orders</h2>
            <Link href="/dashboard/orders" className="text-sm text-indigo hover:underline">
              All orders
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="p-4 text-sm text-muted">No orders yet. Share your store link to get your first sale.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((o) => (
                <li key={o.id}>
                  <Link href={`/dashboard/orders/${o.id}`} className="flex flex-wrap items-center gap-3 p-4 hover:bg-paper">
                    <span className="font-medium">#{o.id}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-muted">{o.customer_name}</span>
                    <StatusBadge status={o.payment_status === "paid" ? o.fulfillment_status : o.payment_status} />
                    <span className="w-24 text-right tabular-nums">{formatMoney(o.total, o.currency)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="h-fit rounded-lg border border-line bg-surface">
          <h2 className="border-b border-line p-4 font-semibold">Running low</h2>
          {lowStock.length === 0 ? (
            <p className="p-4 text-sm text-muted">Every product has more than {LOW_STOCK_THRESHOLD} in stock.</p>
          ) : (
            <ul className="divide-y divide-line">
              {lowStock.map((p) => (
                <li key={p.id}>
                  <Link href={`/dashboard/products/${p.id}`} className="flex justify-between gap-3 p-4 text-sm hover:bg-paper">
                    <span>{p.name}</span>
                    <span className={p.stock === 0 ? "font-semibold text-bad" : "text-warn"}>
                      {p.stock === 0 ? "Sold out" : `${p.stock} left`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: string; href?: string }) {
  const body = (
    <>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums sm:text-3xl">{value}</p>
    </>
  );
  return href ? (
    <Link href={href} className="block bg-surface p-5 hover:bg-indigo-soft">
      {body}
    </Link>
  ) : (
    <div className="bg-surface p-5">{body}</div>
  );
}
