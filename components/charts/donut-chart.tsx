import { cn } from "@/lib/utils";

type DonutPoint = {
  label: string;
  value: number;
  color: string;
};

export function DonutChart({ data, className }: { data: DonutPoint[]; className?: string }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let cumulative = 0;

  const gradient = data
    .map((item) => {
      const start = (cumulative / total) * 100;
      cumulative += item.value;
      const end = (cumulative / total) * 100;
      return `${item.color} ${start}% ${end}%`;
    })
    .join(", ");

  return (
    <div className={cn("flex flex-col gap-6 sm:flex-row sm:items-center", className)}>
      <div
        className="relative h-40 w-40 shrink-0 rounded-full"
        style={{ background: `conic-gradient(${gradient})` }}
        role="img"
        aria-label="Compliance status donut chart"
      >
        <div className="absolute inset-5 grid place-items-center rounded-full bg-white text-center">
          <span>
            <span className="block text-3xl font-bold text-brand-ink">{total}</span>
            <span className="text-xs font-semibold text-slate-500">Centres</span>
          </span>
        </div>
      </div>
      <div className="w-full space-y-3">
        {data.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 font-semibold text-brand-ink">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
            <span className="text-slate-500">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
