import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { STORE_NAME } from "@/lib/config";

export const metadata = { title: "Sign in" };

function safeCallback(value: unknown) {
  // Only allow same-site relative paths.
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default async function SignInPage({ searchParams }: PageProps<"/signin">) {
  const { callbackUrl, error } = await searchParams;
  const redirectTo = safeCallback(callbackUrl);
  if ((await auth())?.user) redirect(redirectTo);

  return (
    <main className="adire flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-lg bg-surface p-8 shadow-xl">
        <Link href="/" className="font-display text-2xl font-bold text-indigo">
          {STORE_NAME}
        </Link>
        <h1 className="mt-6 text-lg font-semibold">Sign in to check out and track your orders</h1>
        {error && (
          <p className="mt-4 rounded-md bg-bad/5 px-3 py-2 text-sm text-bad">
            Google sign-in didn&apos;t complete. Try again, or use a different Google account.
          </p>
        )}
        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo });
          }}
        >
          <button className="btn btn-quiet w-full">
            <svg aria-hidden viewBox="0 0 48 48" className="size-5">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
            </svg>
            Continue with Google
          </button>
        </form>
      </div>
    </main>
  );
}
