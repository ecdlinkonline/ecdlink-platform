import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { UserRole } from "@/lib/auth/roles";

const fallbackAdminEmail = process.env.ECDLINK_FALLBACK_ADMIN_EMAIL;
const fallbackAdminPassword = process.env.ECDLINK_FALLBACK_ADMIN_PASSWORD;

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/auth/fallback"
  },
  providers: [
    Credentials({
      name: "ECDLink fallback",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").toLowerCase();
        const password = String(credentials?.password ?? "");

        if (!fallbackAdminEmail || !fallbackAdminPassword) {
          return null;
        }

        if (email === fallbackAdminEmail.toLowerCase() && password === fallbackAdminPassword) {
          return {
            id: "fallback-super-admin",
            name: "ECDLink Fallback Admin",
            email,
            role: "super_admin" satisfies UserRole
          };
        }

        return null;
      }
    })
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user && "role" in user) {
        token.role = user.role as UserRole;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.role = (token.role as UserRole | undefined) ?? "super_admin";
      }

      return session;
    }
  }
});
