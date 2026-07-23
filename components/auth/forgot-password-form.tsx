"use client";

import { Loader2, MailCheck } from "lucide-react";
import { useState } from "react";
import { type FieldErrors, validateEmail } from "@/lib/auth/validation";
import { FormField } from "@/components/ui/form-field";

type ForgotFields = "email";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<FieldErrors<ForgotFields>>({});

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const emailError = validateEmail(email);
    setErrors(emailError ? { email: emailError } : {});

    if (emailError) {
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSent(true);
    }, 500);
  }

  if (sent) {
    return (
      <div className="rounded-lg border border-green-100 bg-green-50 p-5">
        <MailCheck className="h-8 w-8 text-brand-green" />
        <h3 className="mt-4 font-bold text-brand-ink">Check your email</h3>
        <p className="mt-2 leading-7 text-slate-600">
          If an ECDLink account exists for {email}, a secure reset link has been sent.
        </p>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <FormField
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="principal@centre.org.za"
        value={email}
        error={errors.email}
        onChange={(event) => setEmail(event.target.value)}
      />

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-navy px-5 text-sm font-bold text-white shadow-panel transition hover:bg-blue-950 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailCheck className="h-4 w-4" />}
        Send reset link
      </button>
    </form>
  );
}
