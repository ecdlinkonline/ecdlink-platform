import { cn } from "@/lib/utils";

type BarPoint = {
  label: string;
  value: number;
};

export function BarChart({ data, className }: { data: BarPoint[]; className?: string }) {
  const max = Math.max(...data.map((item) => item.value));

  return (
    <div className={cn("space-y-4", className)}>
      {data.map((item, index) => (
        <div key={`${item.label}-${index}`}>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold text-brand-ink">{item.label}</span>
            <span className="text-slate-500">{item.value}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-navy"
              style={{ width: `${Math.max((item.value / max) * 100, 8)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
