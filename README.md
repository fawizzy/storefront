# Storefront

A small-business shop with a customer storefront, Google sign-in, Paystack checkout and an admin dashboard.

Built with Next.js 16 (App Router), Auth.js (Google), SQLite (`better-sqlite3`) and Tailwind CSS 4.

## What's in it

**Storefront**
- Product grid with category filters, product pages, and a cart saved in the browser
- Sign in with Google to check out; delivery details are remembered from the last order
- Paystack checkout: the server prices the cart from the database, creates a pending order, and sends the customer to Paystack
- Payment is confirmed server-side on return (`/checkout/verify`) and by webhook, with the amount and currency checked against the order; stock is decremented once
- "My orders" page with payment and delivery status

**Dashboard** (`/dashboard`, admins only)
- Overview: all-time revenue, paid orders, orders to ship, customers, 14-day revenue chart, recent orders, low-stock list
- Orders: filter by to ship / paid / awaiting payment / failed; order detail with delivery info and a fulfillment status (not started → processing → shipped → delivered, or cancelled)
- Products: add, edit, hide or delete; set price, stock, category and an optional image URL

## Setup

```bash
npm install
cp .env.example .env.local   # then fill it in
npm run dev
```

### 1. Google sign-in

1. In [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials), create an **OAuth client ID** (type: Web application).
2. Add the redirect URI `http://localhost:3000/api/auth/callback/google` (and your production URL's equivalent).
3. Put the client ID and secret in `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.
4. Set `AUTH_SECRET` with `npx auth secret` or `openssl rand -base64 33`.

### 2. Admin access

Put your Google email(s) in `ADMIN_EMAILS`, comma-separated. Those accounts see the **Dashboard** link after signing in. Changes take effect on the next page load.

### 3. Paystack

1. Copy your secret key from [Paystack → Settings → API Keys & Webhooks](https://dashboard.paystack.com/#/settings/developers) into `PAYSTACK_SECRET_KEY`. Use the `sk_test_…` key until you're ready to go live.
2. Set the **Webhook URL** there to `https://<your-domain>/api/paystack/webhook`. The webhook catches payments where the customer closes the tab before returning to the store. For local testing, expose your dev server with a tunnel (e.g. `ngrok http 3000`).
3. Set `APP_URL` to the site's public URL; it's used for Paystack's callback.

Prices are stored in kobo (minor units). The currency defaults to `NGN`; change `NEXT_PUBLIC_STORE_CURRENCY` if your Paystack account supports another (GHS, ZAR, KES, USD).

## Data

The SQLite database lives at `data/store.db` and is created (with six sample products) on first run. Delete the file to start fresh. Back it up in production; it holds all orders.

When you deploy, pick a host with a persistent disk (a VPS, Railway, Render, Fly.io with a volume). Serverless hosts like Vercel don't keep local files, so there you'd swap SQLite for a hosted database.

## Production

```bash
npm run build
npm start
```
