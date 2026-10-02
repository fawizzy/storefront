import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/AddToCart";
import { ProductArt } from "@/components/ProductArt";
import { db, type Product } from "@/lib/db";
import { formatMoney, LOW_STOCK_THRESHOLD } from "@/lib/config";

function getProduct(slug: string) {
  return db.get<Product>("SELECT * FROM products WHERE slug = ? AND active = 1", slug);
}

export async function generateMetadata({ params }: PageProps<"/products/[slug]">) {
  const product = await getProduct((await params).slug);
  return { title: product?.name ?? "Product not found" };
}

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const product = await getProduct((await params).slug);
  if (!product) notFound();

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 md:grid-cols-2">
      <ProductArt
        id={product.id}
        name={product.name}
        imageUrl={product.image_url}
        className="aspect-square w-full rounded-lg"
      />
      <div className="flex flex-col gap-5">
        <Link href={`/?category=${encodeURIComponent(product.category)}`} className="text-sm text-muted hover:underline">
          {product.category}
        </Link>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">{product.name}</h1>
        <p className="font-display text-3xl font-bold text-indigo">{formatMoney(product.price)}</p>
        <p className="max-w-prose leading-relaxed text-muted">{product.description}</p>
        <p className="text-sm">
          {product.stock <= 0
            ? "Out of stock"
            : product.stock <= LOW_STOCK_THRESHOLD
              ? `Only ${product.stock} left`
              : "In stock"}
        </p>
        <AddToCart
          productId={product.id}
          slug={product.slug}
          name={product.name}
          price={product.price}
          stock={product.stock}
        />
      </div>
    </div>
  );
}
