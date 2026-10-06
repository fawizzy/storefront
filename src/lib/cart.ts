import "server-only";
import { db, type Queries } from "@/lib/db";

export type CartLine = {
  productId: number;
  slug: string;
  name: string;
  price: number; // minor units, always the current database price
  stock: number;
  imageUrl: string | null;
  quantity: number;
};

export type Cart = { version: number; lines: CartLine[]; count: number; subtotal: number };

export const MAX_LINE_QUANTITY = 99;

export class CartError extends Error {}

export async function getCart(userId: number, q: Queries = db): Promise<Cart> {
  // Sequential, since `q` may be an interactive transaction.
  const lines = await q.all<CartLine>(
    `SELECT p.id AS productId, p.slug, p.name, p.price, p.stock, p.image_url AS imageUrl, c.quantity
     FROM cart_items c JOIN products p ON p.id = c.product_id
     WHERE c.user_id = ? AND p.active = 1
     ORDER BY c.added_at, c.product_id`,
    userId,
  );
  const version = await getCartVersion(userId, q);
  return {
    version,
    lines,
    count: lines.reduce((n, l) => n + l.quantity, 0),
    subtotal: lines.reduce((n, l) => n + l.quantity * l.price, 0),
  };
}

export async function getCartVersion(userId: number, q: Queries = db) {
  const row = await q.get<{ version: number }>("SELECT version FROM carts WHERE user_id = ?", userId);
  return row?.version ?? 0;
}

async function bump(tx: Queries, userId: number) {
  await tx.run(
    `INSERT INTO carts (user_id, version) VALUES (?, 1)
     ON CONFLICT(user_id) DO UPDATE SET version = version + 1, updated_at = datetime('now')`,
    userId,
  );
}

async function activeProduct(tx: Queries, productId: number) {
  if (!Number.isInteger(productId)) throw new CartError("Unknown product.");
  const product = await tx.get<{ id: number; stock: number }>(
    "SELECT id, stock FROM products WHERE id = ? AND active = 1",
    productId,
  );
  if (!product) throw new CartError("That product is no longer available.");
  return product;
}

function clampQuantity(quantity: number, stock: number) {
  return Math.max(0, Math.min(Math.floor(quantity), stock, MAX_LINE_QUANTITY));
}

async function writeLine(tx: Queries, userId: number, productId: number, quantity: number) {
  if (quantity <= 0) {
    await tx.run("DELETE FROM cart_items WHERE user_id = ? AND product_id = ?", userId, productId);
  } else {
    await tx.run(
      `INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)
       ON CONFLICT(user_id, product_id) DO UPDATE SET quantity = excluded.quantity`,
      userId, productId, quantity,
    );
  }
}

/** Adds `quantity` of a product, capped at what's in stock. */
export async function addToCart(userId: number, productId: number, quantity = 1) {
  if (!Number.isFinite(quantity) || quantity < 1) throw new CartError("Quantity must be at least 1.");
  return db.transaction(async (tx) => {
    const product = await activeProduct(tx, productId);
    const existing = await tx.get<{ quantity: number }>(
      "SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ?",
      userId, productId,
    );
    const next = clampQuantity((existing?.quantity ?? 0) + quantity, product.stock);
    if (next === 0) throw new CartError("That product is sold out.");
    await writeLine(tx, userId, productId, next);
    await bump(tx, userId);
    return getCart(userId, tx);
  });
}

/** Sets a line's quantity; 0 removes it. */
export async function setCartQuantity(userId: number, productId: number, quantity: number) {
  if (!Number.isFinite(quantity) || quantity < 0) throw new CartError("Quantity can't be negative.");
  return db.transaction(async (tx) => {
    if (quantity === 0) {
      await writeLine(tx, userId, productId, 0);
    } else {
      const product = await activeProduct(tx, productId);
      await writeLine(tx, userId, productId, clampQuantity(quantity, product.stock));
    }
    await bump(tx, userId);
    return getCart(userId, tx);
  });
}

export async function clearCart(userId: number) {
  return db.transaction(async (tx) => {
    await tx.run("DELETE FROM cart_items WHERE user_id = ?", userId);
    await bump(tx, userId);
    return getCart(userId, tx);
  });
}

/**
 * Folds a guest cart (from before sign-in) into the account's cart. For products
 * already in the account's cart, the larger quantity wins so a merge never doubles up.
 */
export async function mergeIntoCart(userId: number, items: { productId: number; quantity: number }[]) {
  return db.transaction(async (tx) => {
    for (const item of items.slice(0, 100)) {
      const product = await tx.get<{ stock: number }>(
        "SELECT stock FROM products WHERE id = ? AND active = 1",
        Number(item.productId),
      );
      if (!product) continue;
      const existing = await tx.get<{ quantity: number }>(
        "SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ?",
        userId, item.productId,
      );
      const next = clampQuantity(Math.max(existing?.quantity ?? 0, Number(item.quantity) || 0), product.stock);
      if (next > 0) await writeLine(tx, userId, item.productId, next);
    }
    await bump(tx, userId);
    return getCart(userId, tx);
  });
}

/** Removes the products of a paid order from the customer's cart. */
export async function removeOrderedItems(userId: number, orderId: number) {
  await db.transaction(async (tx) => {
    const { changes } = await tx.run(
      "DELETE FROM cart_items WHERE user_id = ? AND product_id IN (SELECT product_id FROM order_items WHERE order_id = ?)",
      userId, orderId,
    );
    if (changes > 0) await bump(tx, userId);
  });
}

/**
 * Long-poll helper: resolves once the cart's version differs from `since`, or after
 * `timeoutMs`. Polls the database so it works across serverless instances.
 */
export async function waitForCartChange(userId: number, since: number, timeoutMs: number, signal?: AbortSignal) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline && !signal?.aborted) {
    if ((await getCartVersion(userId)) !== since) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}
