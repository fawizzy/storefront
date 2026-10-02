import Link from "next/link";
import { AddToCart } from "@/components/AddToCart";
import { ProductArt } from "@/components/ProductArt";
import { db, type Product } from "@/lib/db";
import { formatMoney, STORE_NAME } from "@/lib/config";

export default async function Home({ searchParams }: PageProps<"/">) {
  const { category, denied } = await searchParams;
  const categories = (
    await db.all<{ category: string }>("SELECT DISTINCT category FROM products WHERE active = 1 ORDER BY category")
  ).map((r) => r.category);

  const products =
    typeof category === "string"
      ? await db.all<Product>(
          "SELECT * FROM products WHERE active = 1 AND category = ? ORDER BY created_at DESC, id DESC",
          category,
        )
      : await db.all<Product>("SELECT * FROM products WHERE active = 1 ORDER BY created_at DESC, id DESC");

  return (
    <>
      <section className="adire text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <div className="inline-block max-w-2xl bg-indigo p-6 sm:p-8">
            <h1 className="font-display text-5xl leading-[0.95] font-extrabold tracking-tight sm:text-7xl">
              {STORE_NAME}
            </h1>
            <p className="mt-5 max-w-md text-lg text-white/90">
              Spices, grains and pantry staples from small Nigerian producers. Orders ship within two days.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10">
        {denied && (
          <p className="mb-6 rounded-md border border-bad/30 bg-bad/5 px-4 py-3 text-sm text-bad">
            The dashboard is only available to store admins.
          </p>
        )}

        <nav aria-label="Categories" className="mb-8 flex flex-wrap gap-2">
          <CategoryLink href="/" active={!category}>
            Everything
          </CategoryLink>
          {categories.map((c) => (
            <CategoryLink key={c} href={`/?category=${encodeURIComponent(c)}`} active={category === c}>
              {c}
            </CategoryLink>
          ))}
        </nav>

        {products.length === 0 ? (
          <p className="text-muted">Nothing in this category right now.</p>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <li key={p.id} className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface">
                <Link href={`/products/${p.slug}`} className="block">
                  <ProductArt id={p.id} name={p.name} imageUrl={p.image_url} className="aspect-[4/3] w-full" />
                </Link>
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <Link href={`/products/${p.slug}`} className="font-semibold hover:underline">
                      {p.name}
                    </Link>
                    <span className="shrink-0 font-display text-lg font-bold">{formatMoney(p.price)}</span>
                  </div>
                  <p className="line-clamp-2 text-sm text-muted">{p.description}</p>
                  <div className="mt-auto">
                    <AddToCart productId={p.id} slug={p.slug} name={p.name} price={p.price} stock={p.stock} compact />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function CategoryLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-full border px-4 py-1.5 text-sm ${
        active ? "border-indigo bg-indigo text-white" : "border-line bg-surface hover:border-ink"
      }`}
    >
      {children}
    </Link>
  );
}
