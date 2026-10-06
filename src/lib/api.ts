import "server-only";
import { encode, decode } from "next-auth/jwt";
import { auth, adminEmails } from "@/auth";
import { db } from "@/lib/db";

export type ApiUser = { id: number; email: string; name: string | null; image: string | null; isAdmin: boolean };

// A different salt from the session cookie, so a mobile token can't be used as a cookie or vice versa.
const MOBILE_TOKEN_SALT = "storefront.mobile-token";
const MOBILE_TOKEN_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

/** Issues a bearer token for the mobile app, tied to the same user row as the website session. */
export function createMobileToken(user: { id: number; email: string }) {
  return encode({
    token: { sub: String(user.id), email: user.email, kind: "mobile" },
    secret: secret(),
    salt: MOBILE_TOKEN_SALT,
    maxAge: MOBILE_TOKEN_MAX_AGE,
  });
}

async function userByEmail(email: string): Promise<ApiUser | null> {
  const row = await db.get<{ id: number; email: string; name: string | null; image: string | null }>(
    "SELECT id, email, name, image FROM users WHERE email = ?",
    email.toLowerCase(),
  );
  return row ? { ...row, isAdmin: adminEmails().includes(row.email) } : null;
}

/**
 * The signed-in user for an API request: a `Authorization: Bearer <token>` header from
 * the mobile app, or the website's Auth.js session cookie.
 */
export async function getApiUser(request: Request): Promise<ApiUser | null> {
  const header = request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    const payload = await decode({ token: header.slice(7).trim(), secret: secret(), salt: MOBILE_TOKEN_SALT }).catch(
      () => null,
    );
    if (payload?.kind !== "mobile" || typeof payload.email !== "string") return null;
    return userByEmail(payload.email);
  }
  const session = await auth();
  return session?.user?.email ? userByEmail(session.user.email) : null;
}

export function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, { ...init, headers: { "Cache-Control": "no-store", ...init?.headers } });
}

export function apiError(status: number, error: string) {
  return json({ error }, { status });
}

export const unauthorized = () => apiError(401, "Sign in to continue.");

export async function readJson<T>(request: Request): Promise<Partial<T>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}
