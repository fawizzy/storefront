"use client";

import { useState } from "react";
import { useCart } from "./CartProvider";

type Props = { productId: number; slug: string; name: string; price: number; stock: number; compact?: boolean };

export function AddToCart({ productId, slug, name, price, stock, compact }: Props) {
  const { add, lines } = useCart();
  const [added, setAdded] = useState(false);
  const inCart = lines.find((l) => l.productId === productId)?.quantity ?? 0;
  const soldOut = stock <= 0;
  const atLimit = inCart >= stock;

  return (
    <button
      type="button"
      disabled={soldOut || atLimit}
      onClick={() => {
        add({ productId, slug, name, price });
        setAdded(true);
        setTimeout(() => setAdded(false), 1500);
      }}
      className={`btn btn-primary ${compact ? "w-full py-2 text-sm" : "w-full sm:w-auto"}`}
    >
      {soldOut ? "Sold out" : atLimit ? "All in your cart" : added ? "Added to cart" : "Add to cart"}
    </button>
  );
}
