import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({
  children,
  eyebrow,
  title,
  description
}: {
  children: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <main className="min-h-screen bg-brand-accent">
      <div className="grid min-h-screen lg:grid-cols-[0.92fr_1.08fr]">
        <section className="relative hidden overflow-hidden bg-brand-navy p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 opacity-20 grid-pattern" />
          <div className="relative">
            <Link href="/auth/login" className="inline-flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-lg bg-white text-sm font-bold text-brand-navy">
                EL
              </span>
              <span className="text-xl font-bold">ECDLink</span>
            </Link>
            <div className="mt-20 max-w-xl">
              <p className="text-sm font-bold uppercase text-green-200">{eyebrow}</p>
              <h1 className="mt-4 text-5xl font-bold leading-tight">{title}</h1>
              <p className="mt-5 text-lg leading-8 text-blue-100">{description}</p>
            </div>
          </div>

          <div className="relative grid gap-3">
            {[
              "Role-based access for centres, suppliers, donors, funders and ECDLink admins.",
              "Built for compliance records, procurement cycles and funding readiness.",
              "Designed mobile-first for township ECD centre operations."
            ].map((item) => (
              <div key={item} className="rounded-lg border border-white/15 bg-white/10 p-4 text-sm text-blue-50">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
          <div className="w-full max-w-xl">
            <div className="mb-8 flex items-center justify-between lg:hidden">
              <Link href="/auth/login" className="inline-flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-navy text-sm font-bold text-white">
                  EL
                </span>
                <span className="text-xl font-bold text-brand-ink">ECDLink</span>
              </Link>
            </div>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
