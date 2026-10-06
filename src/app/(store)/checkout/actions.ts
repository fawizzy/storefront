"use server";

import { cookies } from "next/headers";
import { auth } from "@/auth";
import { GUEST_ORDER_COOKIE } from "@/lib/config";
import { appUrl, createCheckout, type CheckoutInput } from "@/lib/checkout";

export type CheckoutResult = { url: string } | { error: string };

export async function startCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  const user = (await auth())?.user;
  const result = await createCheckout(input, user?.email ?? null, `${await appUrl()}/checkout/verify`);
  if ("error" in result) return result;

  if (!user?.email) {
    (await cookies()).set(GUEST_ORDER_COOKIE, result.reference, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/checkout",
      maxAge: 60 * 60 * 24,
    });
  }
  return { url: result.url };
}
