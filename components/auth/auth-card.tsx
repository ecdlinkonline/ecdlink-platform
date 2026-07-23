import type { ReactNode } from "react";

export function AuthCard({
  title,
  description,
  children,
  footer
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-brand-line bg-white p-6 shadow-soft sm:p-8">
      <div>
        <h2 className="text-3xl font-bold text-brand-ink">{title}</h2>
        <p className="mt-3 leading-7 text-slate-600">{description}</p>
      </div>
      <div className="mt-8">{children}</div>
      {footer ? <div className="mt-6 border-t border-brand-line pt-5">{footer}</div> : null}
    </div>
  );
}
