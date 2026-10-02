import "server-only";
import Database from "better-sqlite3";
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

function open(): Database.Database {
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const db = new Database(path.join(dir, "store.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);

  const { n } = db.prepare("SELECT COUNT(*) AS n FROM products").get() as { n: number };
  if (n === 0) {
    const insert = db.prepare(
      "INSERT INTO products (name, description, category, price, stock, slug) VALUES (?, ?, ?, ?, ?, ?)",
    );
    db.transaction(() => SEED.forEach((row) => insert.run(...row)))();
  }
  return db;
}

// Reuse one connection across hot reloads in dev.
const globalForDb = globalThis as unknown as { __storeDb?: Database.Database };
export const db = globalForDb.__storeDb ?? open();
if (process.env.NODE_ENV !== "production") globalForDb.__storeDb = db;
