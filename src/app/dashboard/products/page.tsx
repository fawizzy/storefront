import Link from "next/link";
import { db, type Product } from "@/lib/db";
import { formatMoney, LOW_STOCK_THRESHOLD } from "@/lib/config";

export const metadata = { title: "Products" };

export default function ProductsPage() {
  const products = db.prepare("SELECT * FROM products ORDER BY active DESC, name").all() as Product[];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Products</h1>
        <Link href="/dashboard/products/new" className="btn btn-primary">
          Add product
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Category</th>
              <th className="p-3 text-right font-medium">Price</th>
              <th className="p-3 text-right font-medium">Stock</th>
              <th className="p-3 font-medium">Visibility</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {products.map((p) => (
              <tr key={p.id} className={p.active ? "" : "text-muted"}>
                <td className="p-3">
                  <Link href={`/dashboard/products/${p.id}`} className="font-medium text-indigo hover:underline">
                    {p.name}
                  </Link>
                </td>
                <td className="p-3">{p.category}</td>
                <td className="p-3 text-right tabular-nums">{formatMoney(p.price)}</td>
                <td
                  className={`p-3 text-right tabular-nums ${p.stock === 0 ? "font-semibold text-bad" : p.stock <= LOW_STOCK_THRESHOLD ? "text-warn" : ""}`}
                >
                  {p.stock}
                </td>
                <td className="p-3">{p.active ? "In store" : "Hidden"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {products.length === 0 && <p className="p-6 text-center text-muted">Add your first product to open the store.</p>}
      </div>
    </div>
  );
}
