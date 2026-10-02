import "server-only";
import nodemailer from "nodemailer";
import { db, type FulfillmentStatus, type Order, type OrderItem } from "@/lib/db";
import { formatMoney, STORE_NAME } from "@/lib/config";

let transport: nodemailer.Transporter | null | undefined;

function getTransport() {
  if (transport !== undefined) return transport;
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn("SMTP_HOST / SMTP_USER / SMTP_PASS not set; emails will be skipped.");
    return (transport = null);
  }
  const port = Number(process.env.SMTP_PORT ?? 465);
  return (transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  }));
}

/** Sends an email. Never throws: a failed email must not break checkout or the dashboard. */
async function send(to: string | string[], subject: string, html: string) {
  const t = getTransport();
  if (!t || (Array.isArray(to) && to.length === 0)) return;
  try {
    await t.sendMail({
      from: process.env.EMAIL_FROM || `${STORE_NAME} <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error(`Email "${subject}" failed`, err);
  }
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function appUrl() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function layout(body: string) {
  return `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#1c1917">
  <h2 style="margin:0 0 16px">${esc(STORE_NAME)}</h2>
  ${body}
</div>`;
}

async function orderTable(order: Order) {
  const items = await db.all<OrderItem>("SELECT * FROM order_items WHERE order_id = ?", order.id);
  const row = (label: string, value: string, bold = false) =>
    `<tr><td style="padding:4px 0">${label}</td><td style="padding:4px 0;text-align:right${bold ? ";font-weight:700" : ""}">${value}</td></tr>`;
  return `<table style="width:100%;border-collapse:collapse;margin:16px 0">
  ${items.map((i) => row(`${esc(i.name)} × ${i.quantity}`, formatMoney(i.unit_price * i.quantity, order.currency))).join("")}
  ${row("Shipping", formatMoney(order.shipping, order.currency))}
  ${row("Total", formatMoney(order.total, order.currency), true)}
</table>
<p style="margin:0;color:#57534e">Delivering to ${esc(order.customer_name)}, ${esc(order.address)}, ${esc(order.city)} · ${esc(order.phone)}</p>`;
}

function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

/** Customer receipt and admin alert, sent once when an order is first marked paid. */
export async function sendOrderPaidEmails(order: Order) {
  await Promise.all([
    send(
      order.email,
      `Order #${order.id} confirmed`,
      layout(`<p>Thanks, ${esc(order.customer_name.split(" ")[0])}. We've received your payment and are getting your order ready.</p>
${await orderTable(order)}
<p>We'll email you again when it ships.</p>`),
    ),
    send(
      adminEmails(),
      `New order #${order.id}: ${formatMoney(order.total, order.currency)}`,
      layout(`<p>${esc(order.customer_name)} (${esc(order.email)}) just paid.</p>
${await orderTable(order)}
<p><a href="${appUrl()}/dashboard/orders/${order.id}">Open in dashboard</a></p>`),
    ),
  ]);
}

const STATUS_MESSAGES: Partial<Record<FulfillmentStatus, { subject: string; body: string }>> = {
  shipped: { subject: "is on its way", body: "Your order has shipped and is on its way to you." },
  delivered: { subject: "was delivered", body: "Your order has been delivered. Enjoy!" },
  cancelled: {
    subject: "was cancelled",
    body: "Your order has been cancelled. If you didn't expect this, reply to this email and we'll sort it out.",
  },
};

/** Tells the customer about fulfillment changes they care about. */
export async function sendFulfillmentEmail(order: Order) {
  const msg = STATUS_MESSAGES[order.fulfillment_status];
  if (!msg) return;
  await send(
    order.email,
    `Order #${order.id} ${msg.subject}`,
    layout(`<p>Hi ${esc(order.customer_name.split(" ")[0])},</p><p>${msg.body}</p>${await orderTable(order)}`),
  );
}
