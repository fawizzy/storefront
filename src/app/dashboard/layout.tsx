import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { STORE_NAME } from "@/lib/config";
import { DashNav } from "./DashNav";

export const metadata = { title: { default: "Dashboard", template: `%s · Dashboard · ${STORE_NAME}` } };

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await requireAdmin();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="adire-stripe shrink-0 text-white md:w-60">
        <div className="flex h-full flex-col gap-6 bg-indigo/85 p-4 md:p-5">
          <Link href="/" className="font-display text-xl font-bold">
            {STORE_NAME}
          </Link>
          <DashNav />
          <div className="mt-auto hidden text-sm text-white/80 md:block">
            <p className="truncate">{user.email}</p>
            <Link href="/" className="underline">
              View storefront
            </Link>
          </div>
        </div>
      </aside>
      <div className="flex-1 bg-paper px-4 py-8 md:px-10">{children}</div>
    </div>
  );
}
