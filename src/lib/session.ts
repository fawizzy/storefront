import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export async function requireUser(callbackUrl = "/") {
  const session = await auth();
  if (!session?.user?.email) redirect(`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  return session.user;
}

export async function requireAdmin() {
  const user = await requireUser("/dashboard");
  if (!user.isAdmin) redirect("/?denied=1");
  return user;
}
