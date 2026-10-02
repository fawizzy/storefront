import { confirmPayment, isValidWebhookSignature } from "@/lib/paystack";

export async function POST(request: Request) {
  const raw = await request.text();
  if (!isValidWebhookSignature(raw, request.headers.get("x-paystack-signature"))) {
    return new Response("Invalid signature", { status: 401 });
  }

  const event = JSON.parse(raw) as { event: string; data?: { reference?: string } };
  if (event.event === "charge.success" && event.data?.reference) {
    try {
      // Re-verify against the API rather than trusting the payload.
      await confirmPayment(event.data.reference);
    } catch (err) {
      console.error("Webhook confirmPayment failed", err);
      return new Response("Retry", { status: 500 });
    }
  }
  return new Response("ok");
}
