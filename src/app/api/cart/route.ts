import { clearCart, getCart, waitForCartChange } from "@/lib/cart";
import { getApiUser, json, unauthorized } from "@/lib/api";

// Long polls can hold the request open for up to WAIT_MS.
export const maxDuration = 60;
const WAIT_MS = 25_000;

/**
 * GET /api/cart            → the signed-in user's cart
 * GET /api/cart?wait=<v>   → long poll: responds as soon as the cart's version differs
 *                            from <v> (or after ~25s with the unchanged cart)
 */
export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  const wait = new URL(request.url).searchParams.get("wait");
  if (wait !== null && Number.isInteger(Number(wait))) {
    await waitForCartChange(user.id, Number(wait), WAIT_MS, request.signal);
  }
  return json(await getCart(user.id));
}

export async function DELETE(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();
  return json(await clearCart(user.id));
}
