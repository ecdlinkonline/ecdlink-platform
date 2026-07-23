import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Reset access without slowing down centre operations."
      description="ECDLink keeps password recovery simple while preserving the secure access controls needed for sensitive centre, funding and donor records."
    >
      <AuthCard
        title="Reset password"
        description="Enter your account email and we will send a secure reset link."
        footer={
          <p className="text-sm text-slate-600">
            Remembered your password?{" "}
            <Link href="/auth/login" className="font-bold text-brand-navy hover:text-blue-950">
              Back to sign in
            </Link>
          </p>
        }
      >
        <ForgotPasswordForm />
      </AuthCard>
    </AuthShell>
  );
}
