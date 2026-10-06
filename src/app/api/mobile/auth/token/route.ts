import crypto from "node:crypto";
import { db } from "@/lib/db";
import { adminEmails } from "@/auth";
import { apiError, createMobileToken, json, readJson } from "@/lib/api";

/** POST /api/mobile/auth/token { code, code_verifier } → { token, user } */
export async function POST(request: Request) {
  const { code, code_verifier: verifier } = await readJson<{ code: string; code_verifier: string }>(request);
  if (typeof code !== "string" || typeof verifier !== "string") return apiError(400, "Missing code or verifier.");

  // Single use: delete first, then check.
  const row = await db.get<{ user_id: number; challenge: string; expires_at: number }>(
    "DELETE FROM mobile_auth_codes WHERE code = ? RETURNING user_id, challenge, expires_at",
    code,
  );
  const expected = crypto.createHash("sha256").update(verifier).digest("base64url");
  if (!row || row.expires_at < Date.now() || row.challenge !== expected) {
    return apiError(400, "Sign-in expired. Try again.");
  }

  const user = await db.get<{ id: number; email: string; name: string | null; image: string | null }>(
    "SELECT id, email, name, image FROM users WHERE id = ?",
    row.user_id,
  );
  if (!user) return apiError(400, "Account not found.");
  return json({
    token: await createMobileToken(user),
    user: { ...user, isAdmin: adminEmails().includes(user.email) },
  });
}
