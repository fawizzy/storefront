import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db";

export function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  pages: { signIn: "/signin" },
  callbacks: {
    async signIn({ user, profile }) {
      // Only accept Google accounts with a verified email.
      if (!user.email || profile?.email_verified === false) return false;
      await db.run(
        `INSERT INTO users (email, name, image) VALUES (?, ?, ?)
         ON CONFLICT(email) DO UPDATE SET name = excluded.name, image = excluded.image`,
        user.email.toLowerCase(),
        user.name ?? null,
        user.image ?? null,
      );
      return true;
    },
    async jwt({ token }) {
      if (token.email && !token.uid) {
        const row = await db.get<{ id: number }>("SELECT id FROM users WHERE email = ?", token.email.toLowerCase());
        if (row) token.uid = row.id;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = String(token.uid ?? "");
      // Read admin list on every request so changes to ADMIN_EMAILS apply without re-login.
      session.user.isAdmin = adminEmails().includes((session.user.email ?? "").toLowerCase());
      return session;
    },
  },
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isAdmin: boolean;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    uid?: number;
  }
}
