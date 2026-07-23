"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { getDashboardPath, roleOptions, type UserRole } from "@/lib/auth/roles";

export function RoleSelectionForm() {
  const router = useRouter();
  const { isLoaded, user } = useUser();
  const [role, setRole] = useState<UserRole>("ecd_centre");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function saveRole() {
    if (!isLoaded || !user) {
      setError("Your Clerk session is still loading. Please try again.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      await user.update({
        unsafeMetadata: {
          ...user.unsafeMetadata,
          role
        }
      });
      await user.reload();
      router.push(getDashboardPath(role));
    } catch {
      setError("We could not save your role. Please try again.");
      setIsSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-brand-line bg-white p-6 shadow-soft sm:p-8">
      <h1 className="text-3xl font-bold text-brand-ink">Choose your ECDLink role</h1>
      <p className="mt-3 leading-7 text-slate-600">
        This controls which dashboard, onboarding checklist and platform modules you see.
      </p>

      <div className="mt-8 grid gap-3">
        {roleOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setRole(option.id)}
            className={`flex gap-4 rounded-lg border p-4 text-left transition ${
              role === option.id ? "border-brand-navy bg-blue-50" : "border-brand-line hover:border-brand-navy"
            }`}
          >
            <div
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ${
                role === option.id ? "bg-brand-navy text-white" : "bg-brand-accent text-brand-navy"
              }`}
            >
              <option.icon className="h-5 w-5" />
            </div>
            <span>
              <span className="block font-bold text-brand-ink">{option.title}</span>
              <span className="mt-1 block text-sm leading-6 text-slate-600">{option.description}</span>
            </span>
          </button>
        ))}
      </div>

      {error ? <p className="mt-4 text-sm font-semibold text-red-600">{error}</p> : null}

      <button
        type="button"
        onClick={saveRole}
        disabled={isSaving}
        className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-navy px-5 text-sm font-bold text-white shadow-panel transition hover:bg-blue-950 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Continue to dashboard
      </button>
    </div>
  );
}
