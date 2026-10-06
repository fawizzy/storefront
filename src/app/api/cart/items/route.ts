import { addToCart, CartError } from "@/lib/cart";
import { apiError, getApiUser, json, readJson, unauthorized } from "@/lib/api";

/** POST /api/cart/items { productId, quantity? } → adds to the cart (quantity defaults to 1). */
export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();
  const body = await readJson<{ productId: number; quantity: number }>(request);
  try {
    return json(await addToCart(user.id, Number(body.productId), Number(body.quantity ?? 1)));
  } catch (err) {
    if (err instanceof CartError) return apiError(400, err.message);
    throw err;
  }
}
