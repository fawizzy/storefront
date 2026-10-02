"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { Product } from "@/lib/db";
import type { FormState } from "../actions";

type Props = {
  product?: Product;
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
};

export function ProductForm({ product, action, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="grid max-w-2xl gap-5 rounded-lg border border-line bg-surface p-6">
      <Field label="Name">
        <input name="name" required defaultValue={product?.name} className="field" />
      </Field>
      <Field label="Description">
        <textarea name="description" rows={4} defaultValue={product?.description} className="field" />
      </Field>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Price (₦)">
          <input
            name="price"
            type="number"
            step="0.01"
            min="1"
            required
            defaultValue={product ? product.price / 100 : undefined}
            className="field"
          />
        </Field>
        <Field label="Stock">
          <input name="stock" type="number" min="0" step="1" required defaultValue={product?.stock ?? 0} className="field" />
        </Field>
        <Field label="Category">
          <input name="category" defaultValue={product?.category ?? ""} placeholder="General" className="field" />
        </Field>
      </div>
      <Field label="Image URL" hint="Optional. Leave empty to use a patterned tile.">
        <input name="image_url" type="url" defaultValue={product?.image_url ?? ""} placeholder="https://…" className="field" />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input name="active" type="checkbox" defaultChecked={product ? product.active === 1 : true} className="size-4 accent-indigo" />
        Show in store
      </label>

      {state?.error && (
        <p role="alert" className="rounded-md bg-bad/5 px-3 py-2 text-sm text-bad">
          {state.error}
        </p>
      )}

      <div className="flex gap-3">
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link href="/dashboard/products" className="btn btn-quiet">
          Cancel
        </Link>
      </div>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}
