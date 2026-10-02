import Link from "next/link";
import { auth, signOut } from "@/auth";
import { STORE_NAME } from "@/lib/config";
import { CartLink } from "./CartLink";

export async function Header() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="font-display text-xl font-bold tracking-tight text-indigo">
          {STORE_NAME}
        </Link>
        <nav className="ml-auto flex items-center gap-1 text-sm sm:gap-3">
          {user?.isAdmin && (
            <Link href="/dashboard" className="rounded px-2 py-1 hover:bg-indigo-soft">
              Dashboard
            </Link>
          )}
          {user ? (
            <>
              <Link href="/orders" className="rounded px-2 py-1 hover:bg-indigo-soft">
                My orders
              </Link>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button className="rounded px-2 py-1 text-muted hover:bg-indigo-soft hover:text-ink">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link href="/signin" className="rounded px-2 py-1 hover:bg-indigo-soft">
              Sign in
            </Link>
          )}
          <CartLink />
        </nav>
      </div>
    </header>
  );
}
