import type { InputHTMLAttributes } from "react";

type FormFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export function FormField({ label, error, hint, id, className = "", ...props }: FormFieldProps) {
  const inputId = id ?? props.name;

  return (
    <label className="block" htmlFor={inputId}>
      <span className="text-sm font-semibold text-brand-ink">{label}</span>
      <input
        id={inputId}
        className={`mt-2 h-12 w-full rounded-lg border bg-white px-4 text-sm text-brand-ink outline-none transition placeholder:text-slate-400 focus:border-brand-navy focus:ring-4 focus:ring-blue-100 ${
          error ? "border-red-300" : "border-brand-line"
        } ${className}`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        {...props}
      />
      {hint ? (
        <span id={`${inputId}-hint`} className="mt-2 block text-xs text-slate-500">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={`${inputId}-error`} className="mt-2 block text-xs font-semibold text-red-600">
          {error}
        </span>
      ) : null}
    </label>
  );
}
