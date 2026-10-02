"use client";

import Link from "next/link";
import { useCart } from "./CartProvider";

export function CartLink() {
  const { count } = useCart();
  return (
    <Link
      href="/cart"
      className="flex items-center gap-2 rounded-md bg-indigo px-3 py-1.5 font-semibold text-white hover:bg-ink"
    >
      Cart
      <span
        className="min-w-6 rounded-full bg-turmeric px-1.5 text-center text-xs leading-5 text-ink"
        aria-label={`${count} items`}
      >
        {count}
      </span>
    </Link>
  );
}
