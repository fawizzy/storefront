import { CartError, setCartQuantity } from "@/lib/cart";
import { apiError, getApiUser, json, readJson, unauthorized } from "@/lib/api";

type Ctx = RouteContext<"/api/cart/items/[productId]">;

/** PUT /api/cart/items/:productId { quantity } → sets the quantity (0 removes the line). */
export async function PUT(request: Request, ctx: Ctx) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();
  const { productId } = await ctx.params;
  const body = await readJson<{ quantity: number }>(request);
  try {
    return json(await setCartQuantity(user.id, Number(productId), Number(body.quantity)));
  } catch (err) {
    if (err instanceof CartError) return apiError(400, err.message);
    throw err;
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();
  const { productId } = await ctx.params;
  return json(await setCartQuantity(user.id, Number(productId), 0));
}
