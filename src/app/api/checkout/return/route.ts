import { redirect } from "next/navigation";
import { confirmPayment } from "@/lib/paystack";
import { isAppRedirect, redirectToApp } from "@/lib/mobile";

/** Paystack's callback for checkouts started in the app: confirms the payment, then returns to the app. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const reference = params.get("reference") ?? params.get("trxref") ?? "";
  const app = params.get("app");
  if (!isAppRedirect(app)) redirect(`/checkout/verify?reference=${encodeURIComponent(reference)}`);

  let status = "pending";
  try {
    const order = await confirmPayment(reference);
    status = order?.payment_status ?? "unknown";
  } catch (err) {
    console.error(err);
  }
  return redirectToApp(app, { reference, status });
}
