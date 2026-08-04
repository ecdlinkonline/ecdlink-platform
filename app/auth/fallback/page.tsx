import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthShell } from "@/components/auth/auth-shell";
import { NextAuthFallbackForm } from "@/components/auth/next-auth-fallback-form";
import { fallbackAdminEnabled } from "@/lib/security/fallback-auth";

export default function FallbackAuthPage() {
  if (!fallbackAdminEnabled()) notFound();
  return (
    <AuthShell
      eyebrow="Fallback access"
      title="NextAuth recovery path for ECDLink administrators."
      description="Clerk remains the primary authentication provider. NextAuth is available as a controlled fallback for operational continuity."
    >
      <AuthCard
        title="Fallback sign in"
        description="Use only when Clerk access is unavailable or during a controlled migration."
        footer={
          <p className="text-sm text-slate-600">
            Normal login?{" "}
            <Link href="/auth/sign-in" className="font-bold text-brand-navy hover:text-blue-950">
              Return to Clerk sign in
            </Link>
          </p>
        }
      >
        <NextAuthFallbackForm />
      </AuthCard>
    </AuthShell>
  );
}
