import { mergeIntoCart } from "@/lib/cart";
import { getApiUser, json, readJson, unauthorized } from "@/lib/api";

/** POST /api/cart/merge { items: [{ productId, quantity }] } → folds a guest cart into the account's cart. */
export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();
  const { items } = await readJson<{ items: { productId: number; quantity: number }[] }>(request);
  return json(await mergeIntoCart(user.id, Array.isArray(items) ? items : []));
}
