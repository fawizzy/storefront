"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/config";

type Point = { day: string; revenue: number; orders: number };

const dayLabel = (day: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(day + "T00:00:00Z").toLocaleDateString("en-NG", { timeZone: "UTC", ...opts });

/** Pick a round axis maximum and 3 gridlines above zero. */
function niceMax(value: number) {
  if (value <= 0) return 100_00;
  const step = Math.pow(10, Math.floor(Math.log10(value / 3)));
  const nice = [1, 2, 2.5, 5, 10].map((m) => m * step).find((s) => s * 3 >= value)!;
  return nice * 3;
}

export function RevenueChart({ data, currency }: { data: Point[]; currency: string }) {
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(...data.map((d) => d.revenue)));
  const ticks = [max, (max * 2) / 3, max / 3, 0];
  const compact = (v: number) =>
    new Intl.NumberFormat("en-NG", { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(v / 100);
  const hovered = active === null ? null : data[active];

  return (
    <figure className="mt-6">
      <div className="relative flex h-56 gap-3">
        {/* Y axis */}
        <div className="relative w-14 text-right text-xs text-muted tabular-nums" aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${(1 - t / max) * 100}%` }}>
              {compact(t)}
            </span>
          ))}
        </div>
        {/* Plot */}
        <div className="relative flex-1" onPointerLeave={() => setActive(null)}>
          <div className="absolute inset-0" aria-hidden>
            {ticks.map((t) => (
              <div
                key={t}
                className={`absolute inset-x-0 border-t ${t === 0 ? "border-muted/50" : "border-line"}`}
                style={{ top: `${(1 - t / max) * 100}%` }}
              />
            ))}
          </div>
          <ol className="relative flex h-full items-end gap-[2px]" aria-label="Daily revenue">
            {data.map((d, i) => (
              <li
                key={d.day}
                tabIndex={0}
                aria-label={`${dayLabel(d.day, { dateStyle: "medium" })}: ${formatMoney(d.revenue, currency)}, ${d.orders} orders`}
                onPointerEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="flex h-full flex-1 cursor-default items-end outline-offset-0"
              >
                <div
                  className={`w-full rounded-t-[4px] transition-opacity ${active !== null && active !== i ? "opacity-60" : ""}`}
                  style={{ height: `${(d.revenue / max) * 100}%`, background: "var(--mark)", minHeight: d.revenue > 0 ? 2 : 0 }}
                />
              </li>
            ))}
          </ol>
          {hovered && (
            <div
              role="status"
              className={`pointer-events-none absolute z-10 rounded-md ${
                active! < data.length / 4 ? "" : active! >= (data.length * 3) / 4 ? "-translate-x-full" : "-translate-x-1/2"
              } border border-line bg-surface px-3 py-2 text-sm whitespace-nowrap shadow-md`}
              style={{
                left: `${((active! + (active! < data.length / 4 ? 0 : active! >= (data.length * 3) / 4 ? 1 : 0.5)) / data.length) * 100}%`,
                bottom: `min(calc(${(hovered.revenue / max) * 100}% + 8px), calc(100% - 3.5rem))`,
              }}
            >
              <p className="font-bold tabular-nums">{formatMoney(hovered.revenue, currency)}</p>
              <p className="text-xs text-muted">
                {dayLabel(hovered.day, { weekday: "short", day: "numeric", month: "short" })} · {hovered.orders}{" "}
                {hovered.orders === 1 ? "order" : "orders"}
              </p>
            </div>
          )}
        </div>
      </div>
      {/* X axis: label every other day to avoid collisions */}
      <div className="mt-2 ml-[4.25rem] flex gap-[2px] text-xs text-muted" aria-hidden>
        {data.map((d, i) => (
          <span key={d.day} className="flex-1 text-center">
            {i % 2 === (data.length - 1) % 2 ? dayLabel(d.day, { day: "numeric", month: "short" }) : ""}
          </span>
        ))}
      </div>
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-muted hover:text-ink">Show as table</summary>
        <table className="mt-2 w-full max-w-md text-left tabular-nums">
          <thead className="text-muted">
            <tr>
              <th className="py-1 font-medium">Day</th>
              <th className="py-1 text-right font-medium">Orders</th>
              <th className="py-1 text-right font-medium">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.day} className="border-t border-line">
                <td className="py-1">{dayLabel(d.day, { dateStyle: "medium" })}</td>
                <td className="py-1 text-right">{d.orders}</td>
                <td className="py-1 text-right">{formatMoney(d.revenue, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
