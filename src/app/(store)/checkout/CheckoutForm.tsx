"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useCart } from "@/components/CartProvider";
import { formatMoney } from "@/lib/config";
import { startCheckout } from "./actions";

type Props = {
  email: string | null; // null for guests
  shippingFee: number;
  defaults: { name: string; phone: string; address: string; city: string };
};

export function CheckoutForm({ email, shippingFee, defaults }: Props) {
  const { lines, subtotal, ready } = useCart();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (ready && lines.length === 0) {
    return (
      <p className="mt-6 text-muted">
        Your cart is empty.{" "}
        <Link href="/" className="text-indigo underline">
          Browse the shop
        </Link>
      </p>
    );
  }

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await startCheckout({
        items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        email: email ?? String(formData.get("email")),
        name: String(formData.get("name")),
        phone: String(formData.get("phone")),
        address: String(formData.get("address")),
        city: String(formData.get("city")),
      });
      if ("error" in result) setError(result.error);
      else window.location.href = result.url;
    });
  }

  return (
    <form
      onSubmit={(e) => {
        // Handle submit manually so typed details survive an error (form actions reset inputs).
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
      className="mt-8 grid gap-10 md:grid-cols-[1fr_320px]">
      <fieldset className="grid gap-4" disabled={pending}>
        <legend className="mb-2 font-semibold">Delivery details</legend>
        {email ? (
          <p className="text-sm text-muted">
            Receipt goes to <strong className="text-ink">{email}</strong>
          </p>
        ) : (
          <>
            <p className="text-sm text-muted">
              Checking out as a guest.{" "}
              <Link href="/signin?callbackUrl=%2Fcheckout" className="text-indigo underline">
                Sign in
              </Link>{" "}
              to fill in your details and track orders.
            </p>
            <Field label="Email for your receipt" name="email" type="email" autoComplete="email" />
          </>
        )}
        <Field label="Full name" name="name" defaultValue={defaults.name} autoComplete="name" />
        <Field label="Phone number" name="phone" type="tel" defaultValue={defaults.phone} autoComplete="tel" />
        <Field label="Street address" name="address" defaultValue={defaults.address} autoComplete="street-address" />
        <Field label="City" name="city" defaultValue={defaults.city} autoComplete="address-level2" />
      </fieldset>

      <aside className="h-fit rounded-lg border border-line bg-surface p-5">
        <h2 className="font-semibold">Order summary</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {lines.map((l) => (
            <li key={l.productId} className="flex justify-between gap-2">
              <span>
                {l.name} × {l.quantity}
              </span>
              <span className="tabular-nums">{formatMoney(l.price * l.quantity)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1 border-t border-line pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Subtotal</dt>
            <dd className="tabular-nums">{formatMoney(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Shipping</dt>
            <dd className="tabular-nums">{formatMoney(shippingFee)}</dd>
          </div>
          <div className="flex justify-between pt-2 text-base font-bold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatMoney(subtotal + shippingFee)}</dd>
          </div>
        </dl>
        {error && (
          <p role="alert" className="mt-4 rounded-md bg-bad/5 px-3 py-2 text-sm text-bad">
            {error}
          </p>
        )}
        <button className="btn btn-primary mt-5 w-full" disabled={pending || !ready}>
          {pending ? "Opening Paystack…" : `Pay ${formatMoney(subtotal + shippingFee)}`}
        </button>
        <p className="mt-3 text-center text-xs text-muted">You&apos;ll pay on Paystack&apos;s secure page.</p>
      </aside>
    </form>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <input required className="field" {...props} />
    </label>
  );
}
