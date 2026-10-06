/** URL scheme registered by the mobile app (see the app's app.json). */
export const APP_SCHEME = "kokomarket";

/**
 * Where the website may send a user (and their token) back into the app: the app's own
 * scheme, or Expo Go's exp:// links during development.
 */
export function isAppRedirect(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const { protocol } = new URL(value);
    return protocol === `${APP_SCHEME}:` || protocol === "exp:" || protocol === "exps:";
  } catch {
    return false;
  }
}

/** A 302 to an app link (next/navigation's redirect() is meant for web URLs). */
export function redirectToApp(url: string, params: Record<string, string>) {
  return new Response(null, { status: 302, headers: { Location: withParams(url, params), "Cache-Control": "no-store" } });
}

export function withParams(url: string, params: Record<string, string>) {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}
