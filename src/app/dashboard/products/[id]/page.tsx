import { notFound } from "next/navigation";
import { db, type Product } from "@/lib/db";
import { deleteProduct, updateProduct } from "../../actions";
import { ProductForm } from "../ProductForm";

export const metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: PageProps<"/dashboard/products/[id]">) {
  const id = Number((await params).id);
  const product = await db.get<Product>("SELECT * FROM products WHERE id = ?", id);
  if (!product) notFound();

  const { sold } = (await db.get<{ sold: number }>(
    `SELECT COALESCE(SUM(i.quantity), 0) AS sold FROM order_items i
     JOIN orders o ON o.id = i.order_id WHERE i.product_id = ? AND o.payment_status = 'paid'`,
    id,
  ))!;
  const hasOrders = !!(await db.get("SELECT 1 FROM order_items WHERE product_id = ? LIMIT 1", id));

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{product.name}</h1>
      <p className="mt-1 mb-6 text-sm text-muted">{sold} sold so far</p>
      <ProductForm product={product} action={updateProduct.bind(null, id)} submitLabel="Save changes" />

      <form action={deleteProduct.bind(null, id)} className="mt-8 max-w-2xl rounded-lg border border-bad/30 p-6">
        <h2 className="font-semibold">Delete product</h2>
        <p className="mt-1 text-sm text-muted">
          {hasOrders
            ? "This product has past orders, so it will be hidden from the store instead of deleted."
            : "This removes the product permanently."}
        </p>
        <button className="btn mt-4 border border-bad text-bad hover:bg-bad hover:text-white">
          {hasOrders ? "Hide product" : "Delete product"}
        </button>
      </form>
    </div>
  );
}
