"use client";

import { useEffect } from "react";
import { useCart } from "@/components/CartProvider";

export function ClearCart() {
  const { clear, ready, synced } = useCart();
  useEffect(() => {
    // Signed-in carts are cleared on the server when payment is confirmed.
    if (ready && !synced) clear();
  }, [ready, synced, clear]);
  return null;
}
