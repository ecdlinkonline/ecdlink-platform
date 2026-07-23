import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand-navy text-white shadow-panel hover:bg-blue-950",
  secondary: "border border-brand-line bg-white text-brand-ink hover:border-brand-navy hover:text-brand-navy",
  ghost: "text-slate-600 hover:bg-brand-accent hover:text-brand-navy"
};

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
