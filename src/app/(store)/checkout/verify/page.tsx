import Link from "next/link";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { confirmPayment } from "@/lib/paystack";
import { formatMoney, GUEST_ORDER_COOKIE } from "@/lib/config";
import { ClearCart } from "./ClearCart";

export const metadata = { title: "Payment" };

const SHOP = { href: "/", label: "Continue shopping" };

export default async function VerifyPage({ searchParams }: PageProps<"/checkout/verify">) {
  const { reference } = await searchParams;
  const session = await auth();
  const isGuest = !session?.user?.email;
  if (typeof reference !== "string") return <Message title="No payment to check" body="Missing payment reference." />;

  let order;
  try {
    order = await confirmPayment(reference);
  } catch (err) {
    console.error(err);
    return (
      <Message
        title="We couldn't confirm your payment yet"
        body={
          isGuest
            ? "If you were charged, your order will update automatically within a few minutes. Your receipt will come by email."
            : "If you were charged, your order will update automatically within a few minutes. Check My orders shortly."
        }
        cta={isGuest ? SHOP : undefined}
      />
    );
  }

  // Signed-in customers see their own orders; guests see the order this browser started.
  const guestRef = (await cookies()).get(GUEST_ORDER_COOKIE)?.value;
  const canView = order && (isGuest ? guestRef === order.reference : order.email === session.user.email!.toLowerCase());
  if (!order || !canView) {
    return (
      <Message
        title="Order not found"
        body="This payment reference doesn't match any of your orders."
        cta={isGuest ? SHOP : undefined}
      />
    );
  }

  if (order.payment_status === "paid") {
    return (
      <>
        <ClearCart />
        <Message
          title="Payment received"
          body={`Thanks, ${order.customer_name.split(" ")[0]}. We've received ${formatMoney(order.total, order.currency)} for order #${order.id} and will email ${order.email} when it ships.`}
          cta={isGuest ? SHOP : undefined}
        />
      </>
    );
  }
  if (order.payment_status === "failed") {
    return (
      <Message
        title="Payment didn't go through"
        body="You weren't charged. Your cart is still saved, so you can try again."
        cta={{ href: "/checkout", label: "Try again" }}
      />
    );
  }
  return (
    <Message
      title="Payment is still processing"
      body="Paystack hasn't confirmed this payment yet. Your order will update automatically once it does."
      cta={isGuest ? SHOP : undefined}
    />
  );
}

function Message({ title, body, cta = { href: "/orders", label: "View my orders" } }: { title: string; body: string; cta?: { href: string; label: string } }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-4 text-muted">{body}</p>
      <Link href={cta.href} className="btn btn-primary mt-8">
        {cta.label}
      </Link>
    </div>
  );
}
