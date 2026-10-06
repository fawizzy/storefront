# Storefront

A small-business shop with a customer storefront, Google sign-in, Paystack checkout and an admin dashboard.

Built with Next.js 16 (App Router), Auth.js (Google), SQLite via Turso (`@libsql/client`) and Tailwind CSS 4.

## What's in it

**Storefront**
- Product grid with category filters, product pages, and a cart saved to the customer's account (shared with the mobile app; guests get a browser cart)
- Sign in with Google to check out; delivery details are remembered from the last order
- Paystack checkout: the server prices the cart from the database, creates a pending order, and sends the customer to Paystack
- Payment is confirmed server-side on return (`/checkout/verify`) and by webhook, with the amount and currency checked against the order; stock is decremented once
- "My orders" page with payment and delivery status

**Dashboard** (`/dashboard`, admins only)
- Overview: all-time revenue, paid orders, orders to ship, customers, 14-day revenue chart, recent orders, low-stock list
- Orders: filter by to ship / paid / awaiting payment / failed; order detail with delivery info and a fulfillment status (not started → processing → shipped → delivered, or cancelled)
- Products: add, edit, hide or delete; set price, stock, category and an optional image URL

## JSON API (shared with the mobile app)

The website and the [mobile app](../koko-mobile) use the same endpoints. Signed-in requests authenticate with the website's session cookie, or `Authorization: Bearer <token>` from the app.

| Endpoint | |
| --- | --- |
| `GET /api/products[?category=]`, `GET /api/products/:slug` | Catalog (public) |
| `GET /api/me` | Signed-in user and last delivery details |
| `GET /api/cart` | The account's cart. `?wait=<version>` long-polls until it changes (≤25s) |
| `POST /api/cart/items` `{productId, quantity?}` | Add to cart |
| `PUT /api/cart/items/:productId` `{quantity}` · `DELETE …` | Set quantity / remove |
| `DELETE /api/cart` | Empty the cart |
| `POST /api/cart/merge` `{items}` | Fold a guest (browser) cart into the account after sign-in |
| `POST /api/checkout` `{name, phone, address, city, returnUrl?}` | Check out the saved cart; returns the Paystack URL |
| `GET /api/orders` | The account's orders |
| `GET /api/mobile/auth/start`, `POST /api/mobile/auth/token` | App sign-in through the website's Google login (PKCE code exchange) |

Signed-in carts live in the `cart_items` table, so a product added on the website shows up in the app (and the reverse) within about a second. Guests keep a browser cart, which is merged into their account when they sign in.

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

### 4. Email (optional)

The store emails the customer a receipt when payment is confirmed and again when an order is shipped, delivered or cancelled, and alerts everyone in `ADMIN_EMAILS` about each new paid order. It sends through any SMTP provider. With Gmail:

1. Turn on 2-Step Verification for the Google account, then create an app password at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
2. Set `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER` to the Gmail address and `SMTP_PASS` to the 16-character app password.

If the SMTP settings are empty, emails are skipped and a warning is logged.

## Data

The app uses [Turso](https://turso.tech) (hosted SQLite) when `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are set. Create a database there, copy its URL, and create a token. Without them it uses a local file at `data/store.db`. Either way, tables and six sample products are created on first run.

## Deploying to Vercel

1. Import the GitHub repo in Vercel.
2. Add every variable from `.env.local` under **Settings → Environment Variables**, including the Turso ones. Set `APP_URL` to the Vercel URL.
3. In Google Cloud, add `https://<your-app>.vercel.app` as a JavaScript origin and `https://<your-app>.vercel.app/api/auth/callback/google` as a redirect URI.
4. In Paystack, set the webhook URL to `https://<your-app>.vercel.app/api/paystack/webhook`.

## Production

```bash
npm run build
npm start
```
