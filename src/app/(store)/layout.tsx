import { Header } from "@/components/Header";
import { STORE_NAME } from "@/lib/config";

export default function StoreLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line py-8 text-center text-sm text-muted">
        {STORE_NAME} · Payments secured by Paystack
      </footer>
    </>
  );
}
