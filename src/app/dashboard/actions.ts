"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { db, FULFILLMENT_STATUSES, type FulfillmentStatus, type Order } from "@/lib/db";
import { sendFulfillmentEmail } from "@/lib/email";

export type FormState = { error?: string } | undefined;

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function parseProduct(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || "General";
  const imageUrl = String(formData.get("image_url") ?? "").trim() || null;
  const price = Math.round(Number(formData.get("price")) * 100);
  const stock = Number(formData.get("stock"));
  const active = formData.get("active") === "on" ? 1 : 0;

  if (!name) return { error: "Give the product a name." };
  if (!Number.isFinite(price) || price < 100) return { error: "Price must be at least 1.00." };
  if (!Number.isInteger(stock) || stock < 0) return { error: "Stock must be a whole number, 0 or more." };
  if (imageUrl && !/^https:\/\//.test(imageUrl)) return { error: "Image URL must start with https://" };

  return { data: { name, description, category, imageUrl, price, stock, active } };
}

function refreshStore() {
  revalidatePath("/", "layout");
}

export async function createProduct(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = parseProduct(formData);
  if ("error" in parsed) return { error: parsed.error };
  const p = parsed.data;

  let slug = slugify(p.name) || "product";
  for (let i = 2; await db.get("SELECT 1 FROM products WHERE slug = ?", slug); i++) slug = `${slugify(p.name)}-${i}`;

  await db.run(
    `INSERT INTO products (slug, name, description, category, image_url, price, stock, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    slug, p.name, p.description, p.category, p.imageUrl, p.price, p.stock, p.active,
  );
  refreshStore();
  redirect("/dashboard/products");
}

export async function updateProduct(id: number, _: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = parseProduct(formData);
  if ("error" in parsed) return { error: parsed.error };
  const p = parsed.data;
  await db.run(
    `UPDATE products SET name = ?, description = ?, category = ?, image_url = ?, price = ?, stock = ?, active = ?
     WHERE id = ?`,
    p.name, p.description, p.category, p.imageUrl, p.price, p.stock, p.active, id,
  );
  refreshStore();
  redirect("/dashboard/products");
}

export async function deleteProduct(id: number) {
  await requireAdmin();
  const { n } = (await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM order_items WHERE product_id = ?", id))!;
  if (n > 0) {
    // Keep order history intact: hide instead of deleting.
    await db.run("UPDATE products SET active = 0 WHERE id = ?", id);
  } else {
    await db.run("DELETE FROM products WHERE id = ?", id);
  }
  refreshStore();
  redirect("/dashboard/products");
}

export async function setFulfillment(orderId: number, formData: FormData) {
  await requireAdmin();
  const status = String(formData.get("status")) as FulfillmentStatus;
  if (!FULFILLMENT_STATUSES.includes(status)) return;
  const { changes } = await db.run(
    "UPDATE orders SET fulfillment_status = ? WHERE id = ? AND payment_status = 'paid' AND fulfillment_status != ?",
    status, orderId, status,
  );
  revalidatePath("/dashboard", "layout");
  revalidatePath("/orders");
  if (changes === 1) {
    await sendFulfillmentEmail((await db.get<Order>("SELECT * FROM orders WHERE id = ?", orderId))!);
  }
}
