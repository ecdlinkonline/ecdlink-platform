"use client";

import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { roleOptions, type UserRole } from "@/lib/auth/roles";
import { type FieldErrors, validateEmail, validatePassword } from "@/lib/auth/validation";
import { FormField } from "@/components/ui/form-field";

type LoginFields = "email" | "password";

export function LoginForm() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>("ecd_centre");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors<LoginFields>>({});

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: FieldErrors<LoginFields> = {
      email: validateEmail(email),
      password: validatePassword(password)
    };

    Object.keys(nextErrors).forEach((key) => {
      if (!nextErrors[key as LoginFields]) {
        delete nextErrors[key as LoginFields];
      }
    });

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    window.localStorage.setItem(
      "ecdlink.auth.preview",
      JSON.stringify({
        email,
        role,
        rememberMe,
        authenticatedAt: new Date().toISOString()
      })
    );

    setTimeout(() => {
      router.push(`/dashboard?role=${role}`);
    }, 450);
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div>
        <p className="mb-3 text-sm font-semibold text-brand-ink">Sign in as</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {roleOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setRole(option.id)}
              className={`flex items-center gap-3 rounded-lg border p-3 text-left transition ${
                role === option.id
                  ? "border-brand-navy bg-blue-50 text-brand-navy"
                  : "border-brand-line bg-white text-slate-600 hover:border-brand-navy"
              }`}
            >
              <option.icon className="h-5 w-5 shrink-0" />
              <span className="text-sm font-semibold">{option.shortTitle}</span>
            </button>
          ))}
        </div>
      </div>

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

      <div>
        <div className="relative">
          <FormField
            label="Password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            error={errors.password}
            onChange={(event) => setPassword(event.target.value)}
            className="pr-12"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute right-3 top-9 grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-brand-accent"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
            className="h-4 w-4 rounded border-brand-line text-brand-navy"
          />
          Keep me signed in
        </label>
        <a href="/auth/forgot-password" className="text-sm font-semibold text-brand-navy hover:text-blue-950">
          Forgot password?
        </a>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-navy px-5 text-sm font-bold text-white shadow-panel transition hover:bg-blue-950 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
        Sign in to ECDLink
      </button>
    </form>
  );
}
