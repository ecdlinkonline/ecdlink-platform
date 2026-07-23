"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { roleOptions, type UserRole } from "@/lib/auth/roles";
import { type FieldErrors, validateEmail, validatePassword, validateRequired } from "@/lib/auth/validation";
import { FormField } from "@/components/ui/form-field";

type RegisterFields = "organisationName" | "contactName" | "email" | "password";

export function RegisterForm() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>("ecd_centre");
  const [organisationName, setOrganisationName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [termsError, setTermsError] = useState("");
  const [errors, setErrors] = useState<FieldErrors<RegisterFields>>({});

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: FieldErrors<RegisterFields> = {
      organisationName: validateRequired(organisationName, "Organisation name"),
      contactName: validateRequired(contactName, "Contact person"),
      email: validateEmail(email),
      password: validatePassword(password)
    };

    Object.keys(nextErrors).forEach((key) => {
      if (!nextErrors[key as RegisterFields]) {
        delete nextErrors[key as RegisterFields];
      }
    });

    setErrors(nextErrors);
    setTermsError(acceptedTerms ? "" : "Please accept the ECDLink platform terms.");

    if (Object.keys(nextErrors).length > 0 || !acceptedTerms) {
      return;
    }

    setIsSubmitting(true);

    window.localStorage.setItem(
      "ecdlink.registration.preview",
      JSON.stringify({
        role,
        organisationName,
        contactName,
        email,
        submittedAt: new Date().toISOString()
      })
    );

    setTimeout(() => {
      router.push(`/dashboard?role=${role}&onboarding=true`);
    }, 500);
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div>
        <p className="mb-3 text-sm font-semibold text-brand-ink">Account type</p>
        <div className="grid gap-2">
          {roleOptions
            .filter((option) => option.id !== "super_admin")
            .map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setRole(option.id)}
                className={`flex gap-3 rounded-lg border p-4 text-left transition ${
                  role === option.id
                    ? "border-brand-navy bg-blue-50"
                    : "border-brand-line bg-white hover:border-brand-navy"
                }`}
              >
                <option.icon className={`mt-1 h-5 w-5 ${role === option.id ? "text-brand-navy" : "text-slate-500"}`} />
                <span>
                  <span className="block font-bold text-brand-ink">{option.title}</span>
                  <span className="mt-1 block text-sm leading-6 text-slate-600">{option.description}</span>
                </span>
              </button>
            ))}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          label="Organisation name"
          name="organisationName"
          placeholder="Little Stars ECD Centre"
          value={organisationName}
          error={errors.organisationName}
          onChange={(event) => setOrganisationName(event.target.value)}
        />
        <FormField
          label="Contact person"
          name="contactName"
          placeholder="Nomsa Dlamini"
          value={contactName}
          error={errors.contactName}
          onChange={(event) => setContactName(event.target.value)}
        />
      </div>

      <FormField
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="hello@centre.org.za"
        value={email}
        error={errors.email}
        onChange={(event) => setEmail(event.target.value)}
      />

      <FormField
        label="Create password"
        name="password"
        type="password"
        autoComplete="new-password"
        placeholder="Minimum 8 characters"
        value={password}
        error={errors.password}
        hint="Use a strong password. Two-factor authentication will be added for admin accounts."
        onChange={(event) => setPassword(event.target.value)}
      />

      <label className="block">
        <span className="flex gap-3 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(event) => setAcceptedTerms(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-brand-line text-brand-navy"
          />
          <span>I agree to the ECDLink platform terms and understand that centre information may be verified.</span>
        </span>
        {termsError ? <span className="mt-2 block text-xs font-semibold text-red-600">{termsError}</span> : null}
      </label>

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-navy px-5 text-sm font-bold text-white shadow-panel transition hover:bg-blue-950 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
        Create ECDLink account
      </button>
    </form>
  );
}
