import { auth } from "@/auth";
import { lastDeliveryDetails } from "@/lib/checkout";
import { SHIPPING_FEE } from "@/lib/config";
import { CheckoutForm } from "./CheckoutForm";

export const metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const user = (await auth())?.user;
  const email = user?.email?.toLowerCase() ?? null;

  // Prefill from a signed-in customer's most recent order.
  const last = email ? await lastDeliveryDetails(email) : undefined;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">Checkout</h1>
      <CheckoutForm
        email={user?.email ?? null}
        shippingFee={SHIPPING_FEE}
        defaults={{
          name: last?.customer_name ?? user?.name ?? "",
          phone: last?.phone ?? "",
          address: last?.address ?? "",
          city: last?.city ?? "",
        }}
      />
    </div>
  );
}
