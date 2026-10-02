"use client";

import Link from "next/link";
import { useCart } from "@/components/CartProvider";
import { formatMoney } from "@/lib/config";

export default function CartPage() {
  const { lines, subtotal, setQuantity, remove, ready } = useCart();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">Your cart</h1>

      {!ready ? null : lines.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-line p-10 text-center">
          <p className="text-muted">Your cart is empty.</p>
          <Link href="/" className="btn btn-primary mt-4">
            Browse the shop
          </Link>
        </div>
      ) : (
        <>
          <ul className="mt-8 divide-y divide-line rounded-lg border border-line bg-surface">
            {lines.map((l) => (
              <li key={l.productId} className="flex flex-wrap items-center gap-4 p-4">
                <Link href={`/products/${l.slug}`} className="flex-1 font-semibold hover:underline">
                  {l.name}
                </Link>
                <div className="flex items-center rounded-md border border-line">
                  <button
                    type="button"
                    aria-label={`Remove one ${l.name}`}
                    onClick={() => setQuantity(l.productId, l.quantity - 1)}
                    className="px-3 py-1 hover:bg-indigo-soft"
                  >
                    −
                  </button>
                  <span className="w-8 text-center tabular-nums">{l.quantity}</span>
                  <button
                    type="button"
                    aria-label={`Add one ${l.name}`}
                    onClick={() => setQuantity(l.productId, l.quantity + 1)}
                    className="px-3 py-1 hover:bg-indigo-soft"
                  >
                    +
                  </button>
                </div>
                <span className="w-24 text-right tabular-nums">{formatMoney(l.price * l.quantity)}</span>
                <button type="button" onClick={() => remove(l.productId)} className="text-sm text-muted hover:text-bad">
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <p className="text-lg">
              Subtotal <span className="font-display text-2xl font-bold">{formatMoney(subtotal)}</span>
            </p>
            <Link href="/checkout" className="btn btn-primary">
              Check out
            </Link>
          </div>
          <p className="mt-2 text-sm text-muted">Shipping is added at checkout. Stock is confirmed when you pay.</p>
        </>
      )}
    </div>
  );
}
