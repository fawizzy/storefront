import { db, type Product } from "@/lib/db";
import { apiError, json } from "@/lib/api";

export async function GET(_request: Request, ctx: RouteContext<"/api/products/[slug]">) {
  const { slug } = await ctx.params;
  const product = await db.get<Omit<Product, "active">>(
    "SELECT id, slug, name, description, price, stock, image_url, category, created_at FROM products WHERE slug = ? AND active = 1",
    slug,
  );
  return product ? json({ product }) : apiError(404, "Product not found.");
}
