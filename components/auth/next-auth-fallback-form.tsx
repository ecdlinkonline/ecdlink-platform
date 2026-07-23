"use client";

import { Loader2, ShieldCheck } from "lucide-react";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { FormField } from "@/components/ui/form-field";

export function NextAuthFallbackForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/dashboard/super-admin"
    });

    if (result?.error) {
      setError("Fallback credentials were not accepted.");
      setIsSubmitting(false);
      return;
    }

    window.location.href = result?.url ?? "/dashboard/super-admin";
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        This fallback is intended for controlled recovery access. Use Clerk for normal ECDLink authentication.
      </div>
      <FormField
        label="Fallback admin email"
        name="email"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="admin@ecdlink.co.za"
      />
      <FormField
        label="Fallback password"
        name="password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Enter fallback password"
      />
      {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-navy px-5 text-sm font-bold text-white shadow-panel transition hover:bg-blue-950 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        Use NextAuth fallback
      </button>
    </form>
  );
}
