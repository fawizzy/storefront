import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { apiError } from "@/lib/api";
import { isAppRedirect, redirectToApp } from "@/lib/mobile";

const CODE_TTL_MS = 5 * 60 * 1000;

/**
 * GET /api/mobile/auth/start?redirect_uri=<app link>&code_challenge=<base64url sha256>
 *
 * The app opens this in the system browser. It signs the user in with the website's
 * normal Google sign-in (or reuses their website session), then sends a one-time code
 * back to the app, which swaps it for a token at /api/mobile/auth/token.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const redirectUri = url.searchParams.get("redirect_uri");
  const challenge = url.searchParams.get("code_challenge") ?? "";
  if (!isAppRedirect(redirectUri)) return apiError(400, "Invalid redirect_uri.");
  if (!/^[A-Za-z0-9_-]{43}$/.test(challenge)) return apiError(400, "Invalid code_challenge.");

  const session = await auth();
  if (!session?.user?.email) {
    redirect(`/signin?callbackUrl=${encodeURIComponent(url.pathname + url.search)}`);
  }

  const user = await db.get<{ id: number }>("SELECT id FROM users WHERE email = ?", session.user.email.toLowerCase());
  if (!user) return apiError(401, "Account not found.");

  const code = crypto.randomBytes(32).toString("base64url");
  await db.run("DELETE FROM mobile_auth_codes WHERE expires_at < ?", Date.now());
  await db.run(
    "INSERT INTO mobile_auth_codes (code, user_id, challenge, expires_at) VALUES (?, ?, ?, ?)",
    code, user.id, challenge, Date.now() + CODE_TTL_MS,
  );
  return redirectToApp(redirectUri, { code });
}
