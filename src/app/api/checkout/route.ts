import { getCart } from "@/lib/cart";
import { appUrl, createCheckout, type CheckoutInput } from "@/lib/checkout";
import { apiError, getApiUser, json, readJson, unauthorized } from "@/lib/api";
import { isAppRedirect } from "@/lib/mobile";

/**
 * POST /api/checkout { name, phone, address, city, returnUrl? }
 * Checks out the signed-in user's saved cart and returns the Paystack page to open.
 * With a mobile `returnUrl`, Paystack sends the customer back into the app afterwards.
 */
export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();
  const body = await readJson<Omit<CheckoutInput, "items" | "email"> & { returnUrl: string }>(request);

  const cart = await getCart(user.id);
  const base = await appUrl();
  const callbackUrl = isAppRedirect(body.returnUrl)
    ? `${base}/api/checkout/return?app=${encodeURIComponent(body.returnUrl)}`
    : `${base}/checkout/verify`;

  const result = await createCheckout(
    {
      ...body,
      items: cart.lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
    },
    user.email,
    callbackUrl,
  );
  return "error" in result ? apiError(400, result.error) : json(result);
}
