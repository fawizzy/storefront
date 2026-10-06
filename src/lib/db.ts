import "server-only";
import { createClient, type Client, type InValue, type ResultSet } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

export type Product = {
  id: number;
  slug: string;
  name: string;
  description: string;
  price: number; // minor units (kobo)
  stock: number;
  image_url: string | null;
  category: string;
  active: number;
  created_at: string;
};

export type Order = {
  id: number;
  reference: string;
  user_id: number | null;
  email: string;
  customer_name: string;
  phone: string;
  address: string;
  city: string;
  subtotal: number;
  shipping: number;
  total: number;
  currency: string;
  payment_status: "pending" | "paid" | "failed";
  fulfillment_status: FulfillmentStatus;
  paystack_id: string | null;
  paid_at: string | null;
  created_at: string;
};

export const FULFILLMENT_STATUSES = [
  "unfulfilled",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const;
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

export type OrderItem = {
  id: number;
  order_id: number;
  product_id: number;
  name: string;
  unit_price: number;
  quantity: number;
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  image TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL CHECK (price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image_url TEXT,
  category TEXT NOT NULL DEFAULT 'General',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  user_id INTEGER REFERENCES users(id),
  email TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  subtotal INTEGER NOT NULL,
  shipping INTEGER NOT NULL,
  total INTEGER NOT NULL,
  currency TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  fulfillment_status TEXT NOT NULL DEFAULT 'unfulfilled',
  paystack_id TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  name TEXT NOT NULL,
  unit_price INTEGER NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0)
);
-- One cart per signed-in user, shared by the website and the mobile app.
-- version goes up on every change so clients can wait for the next one.
CREATE TABLE IF NOT EXISTS carts (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS cart_items (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, product_id)
);
-- One-time codes the mobile app swaps for a token after signing in on the website (PKCE).
CREATE TABLE IF NOT EXISTS mobile_auth_codes (
  code TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_paid_at ON orders(paid_at);
`;

const SEED: Array<[string, string, string, number, number, string]> = [
  ["Yaji suya spice", "Kano-style blend of groundnut, ginger, cloves and dried pepper. 200g jar.", "Spices", 450000, 40, "yaji-suya-spice"],
  ["Dried zobo leaves", "Sun-dried hibiscus calyces for a deep red zobo. 500g pouch.", "Drinks", 300000, 60, "dried-zobo-leaves"],
  ["Ofada rice", "Unpolished short-grain rice from Ogun State, destoned twice. 2kg bag.", "Grains", 850000, 25, "ofada-rice"],
  ["Coconut chin chin", "Crunchy, lightly sweet, fried in small batches every Thursday. 400g tub.", "Snacks", 350000, 30, "coconut-chin-chin"],
  ["Unrefined shea butter", "Cold-pressed in Saki, Oyo. Nothing added. 250g tin.", "Body", 550000, 18, "unrefined-shea-butter"],
  ["Ogiri okpei", "Fermented locust bean seasoning for ofe onugbu and egusi. 150g.", "Spices", 250000, 4, "ogiri-okpei"],
];

// Turso in production (TURSO_DATABASE_URL); a local SQLite file otherwise.
function connect(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  if (url) return createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  return createClient({ url: `file:${path.join(dir, "store.db")}` });
}

async function init(client: Client) {
  await client.executeMultiple(SCHEMA);
  const { rows } = await client.execute("SELECT COUNT(*) AS n FROM products");
  if (Number(rows[0].n) === 0) {
    await client.batch(
      SEED.map((args) => ({
        sql: "INSERT INTO products (name, description, category, price, stock, slug) VALUES (?, ?, ?, ?, ?, ?)",
        args,
      })),
      "write",
    );
  }
}

// Reuse one client (and its schema setup) across hot reloads in dev.
const globalForDb = globalThis as unknown as { __storeLibsql?: { client: Client; ready: Promise<void> } };
const conn =
  globalForDb.__storeLibsql ??
  (() => {
    const client = connect();
    return { client, ready: init(client) };
  })();
if (process.env.NODE_ENV !== "production") globalForDb.__storeLibsql = conn;

type Executor = { execute(stmt: { sql: string; args: InValue[] }): Promise<ResultSet> };

function toObjects<T>(rs: ResultSet): T[] {
  return rs.rows.map((row) => Object.fromEntries(rs.columns.map((c, i) => [c, row[i]])) as T);
}

function queries(ex: Executor) {
  return {
    async all<T>(sql: string, ...args: InValue[]): Promise<T[]> {
      return toObjects<T>(await ex.execute({ sql, args }));
    },
    async get<T>(sql: string, ...args: InValue[]): Promise<T | undefined> {
      return toObjects<T>(await ex.execute({ sql, args }))[0];
    },
    async run(sql: string, ...args: InValue[]) {
      const rs = await ex.execute({ sql, args });
      return { changes: rs.rowsAffected, lastInsertRowid: Number(rs.lastInsertRowid) };
    },
  };
}

export type Queries = ReturnType<typeof queries>;

const base = queries({
  async execute(stmt) {
    await conn.ready;
    return conn.client.execute(stmt);
  },
});

export const db = {
  ...base,
  /** Runs fn in a write transaction; commits if it resolves, rolls back if it throws. */
  async transaction<T>(fn: (tx: Queries) => Promise<T>): Promise<T> {
    await conn.ready;
    const tx = await conn.client.transaction("write");
    try {
      const result = await fn(queries(tx));
      await tx.commit();
      return result;
    } finally {
      tx.close();
    }
  },
};
