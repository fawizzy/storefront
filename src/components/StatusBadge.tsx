const STYLES: Record<string, { cls: string; label: string }> = {
  paid: { cls: "bg-good/10 text-good", label: "Paid" },
  pending: { cls: "bg-warn/10 text-warn", label: "Awaiting payment" },
  failed: { cls: "bg-bad/10 text-bad", label: "Payment failed" },
  unfulfilled: { cls: "bg-line text-muted", label: "Not started" },
  processing: { cls: "bg-warn/10 text-warn", label: "Processing" },
  shipped: { cls: "bg-indigo-soft text-indigo", label: "Shipped" },
  delivered: { cls: "bg-good/10 text-good", label: "Delivered" },
  cancelled: { cls: "bg-bad/10 text-bad", label: "Cancelled" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STYLES[status] ?? { cls: "bg-line text-muted", label: status };
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${s.cls}`}>{s.label}</span>;
}
