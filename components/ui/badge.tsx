import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "muted";

const variants: Record<BadgeVariant, string> = {
  default: "bg-blue-50 text-brand-navy",
  success: "bg-green-50 text-brand-green",
  warning: "bg-amber-50 text-amber-700",
  muted: "bg-slate-100 text-slate-600"
};

export function Badge({
  className,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold", variants[variant], className)}
      {...props}
    />
  );
}
