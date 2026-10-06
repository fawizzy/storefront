"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type CartLine = { productId: number; slug: string; name: string; price: number; quantity: number };

type CartContextValue = {
  lines: CartLine[];
  count: number;
  subtotal: number;
  ready: boolean;
  /** True when the cart is saved to the signed-in account (shared with the mobile app). */
  synced: boolean;
  add: (line: Omit<CartLine, "quantity">, quantity?: number) => void;
  setQuantity: (productId: number, quantity: number) => void;
  remove: (productId: number) => void;
  clear: () => void;
};

type ServerCart = { version: number; lines: CartLine[] };

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "storefront-cart";

function readGuestCart(): CartLine[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function writeGuestCart(lines: CartLine[]) {
  try {
    if (lines.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

async function cartRequest(path: string, init?: RequestInit): Promise<ServerCart | null> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? res.statusText);
  return res.json();
}

/**
 * Guests: cart lives in localStorage. Signed in: cart lives on the server at /api/cart
 * (the same endpoints the mobile app uses) and a long poll picks up changes made elsewhere.
 */
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const [synced, setSynced] = useState(false);
  const version = useRef(-1);

  // Accept a server cart only if it's not older than the one we already show.
  const applyServer = useCallback((cart: ServerCart) => {
    if (cart.version < version.current) return;
    version.current = cart.version;
    setLines(cart.lines);
  }, []);

  const toGuest = useCallback(() => {
    version.current = -1;
    setSynced(false);
    setLines(readGuestCart());
  }, []);

  useEffect(() => {
    let stopped = false;
    let controller = new AbortController();

    async function start() {
      try {
        const guest = readGuestCart();
        const cart = guest.length
          ? await cartRequest("/api/cart/merge", {
              method: "POST",
              body: JSON.stringify({ items: guest.map((l) => ({ productId: l.productId, quantity: l.quantity })) }),
            })
          : await cartRequest("/api/cart");
        if (stopped) return;
        if (!cart) {
          toGuest();
          setReady(true);
          return;
        }
        writeGuestCart([]);
        applyServer(cart);
        setSynced(true);
        setReady(true);
        listen();
      } catch {
        if (!stopped) {
          toGuest();
          setReady(true);
        }
      }
    }

    async function listen() {
      while (!stopped) {
        if (document.visibilityState === "hidden") {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
        try {
          const cart = await cartRequest(`/api/cart?wait=${version.current}`, { signal: controller.signal });
          if (stopped) return;
          if (!cart) return toGuest(); // signed out
          applyServer(cart);
        } catch {
          if (stopped) return;
          const aborted = controller.signal.aborted;
          controller = new AbortController();
          // Aborted on purpose (tab became visible): poll again now. Otherwise back off.
          if (!aborted) await new Promise((r) => setTimeout(r, 3000));
        }
      }
    }

    // When the tab comes back, cut the current wait short so we refresh right away.
    function onVisible() {
      if (document.visibilityState === "visible") controller.abort();
    }
    document.addEventListener("visibilitychange", onVisible);
    start();
    return () => {
      stopped = true;
      controller.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [applyServer, toGuest]);

  // Guests: persist every change locally.
  useEffect(() => {
    if (ready && !synced) writeGuestCart(lines);
  }, [lines, ready, synced]);

  const mutate = useCallback(
    (optimistic: (prev: CartLine[]) => CartLine[], path: string, init: RequestInit) => {
      setLines(optimistic);
      if (!synced) return;
      cartRequest(path, init)
        .then((cart) => (cart ? applyServer(cart) : toGuest()))
        .catch(() => cartRequest("/api/cart").then((cart) => cart && applyServer(cart)));
    },
    [synced, applyServer, toGuest],
  );

  const add = useCallback<CartContextValue["add"]>(
    (line, quantity = 1) =>
      mutate(
        (prev) =>
          prev.some((l) => l.productId === line.productId)
            ? prev.map((l) => (l.productId === line.productId ? { ...l, quantity: l.quantity + quantity } : l))
            : [...prev, { ...line, quantity }],
        "/api/cart/items",
        { method: "POST", body: JSON.stringify({ productId: line.productId, quantity }) },
      ),
    [mutate],
  );

  const setQuantity = useCallback(
    (productId: number, quantity: number) =>
      mutate(
        (prev) =>
          quantity <= 0
            ? prev.filter((l) => l.productId !== productId)
            : prev.map((l) => (l.productId === productId ? { ...l, quantity } : l)),
        `/api/cart/items/${productId}`,
        { method: "PUT", body: JSON.stringify({ quantity: Math.max(0, quantity) }) },
      ),
    [mutate],
  );

  const remove = useCallback(
    (productId: number) =>
      mutate((prev) => prev.filter((l) => l.productId !== productId), `/api/cart/items/${productId}`, {
        method: "DELETE",
      }),
    [mutate],
  );

  const clear = useCallback(() => mutate(() => [], "/api/cart", { method: "DELETE" }), [mutate]);

  const value = useMemo(
    () => ({
      lines,
      ready,
      synced,
      count: lines.reduce((n, l) => n + l.quantity, 0),
      subtotal: lines.reduce((n, l) => n + l.quantity * l.price, 0),
      add,
      setQuantity,
      remove,
      clear,
    }),
    [lines, ready, synced, add, setQuantity, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
