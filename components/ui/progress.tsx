import { cn } from "@/lib/utils";

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-2 overflow-hidden rounded-full bg-slate-100", className)}>
      <div className="h-full rounded-full bg-brand-green" style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
    </div>
  );
}
