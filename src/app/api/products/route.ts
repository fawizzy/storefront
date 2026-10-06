import { db, type Product } from "@/lib/db";
import { CURRENCY, SHIPPING_FEE, STORE_NAME } from "@/lib/config";
import { json } from "@/lib/api";

type PublicProduct = Omit<Product, "active">;

const COLUMNS = "id, slug, name, description, price, stock, image_url, category, created_at";

export async function GET(request: Request) {
  const category = new URL(request.url).searchParams.get("category");
  const products = category
    ? await db.all<PublicProduct>(
        `SELECT ${COLUMNS} FROM products WHERE active = 1 AND category = ? ORDER BY created_at DESC, id DESC`,
        category,
      )
    : await db.all<PublicProduct>(`SELECT ${COLUMNS} FROM products WHERE active = 1 ORDER BY created_at DESC, id DESC`);
  const categories = (
    await db.all<{ category: string }>("SELECT DISTINCT category FROM products WHERE active = 1 ORDER BY category")
  ).map((r) => r.category);

  return json({ store: { name: STORE_NAME, currency: CURRENCY, shippingFee: SHIPPING_FEE }, categories, products });
}
