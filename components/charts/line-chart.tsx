import { cn } from "@/lib/utils";

type ChartPoint = {
  month: string;
  value: number;
};

export function LineChart({
  data,
  color = "#1E3A8A",
  className
}: {
  data: ChartPoint[];
  color?: string;
  className?: string;
}) {
  const width = 640;
  const height = 220;
  const padding = 24;
  const max = Math.max(...data.map((point) => point.value));
  const min = Math.min(...data.map((point) => point.value));
  const range = max - min || 1;

  const points = data.map((point, index) => {
    const x = padding + (index / Math.max(data.length - 1, 1)) * (width - padding * 2);
    const y = height - padding - ((point.value - min) / range) * (height - padding * 2);
    return { ...point, x, y };
  });

  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const fillPath = `${path} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return (
    <div className={cn("w-full", className)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full" role="img" aria-label="Trend line chart">
        <defs>
          <linearGradient id={`fill-${color.replace("#", "")}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((line) => {
          const y = padding + line * ((height - padding * 2) / 3);
          return <line key={line} x1={padding} x2={width - padding} y1={y} y2={y} stroke="#E5E7EB" />;
        })}
        <path d={fillPath} fill={`url(#fill-${color.replace("#", "")})`} />
        <path d={path} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
        {points.map((point) => (
          <circle key={point.month} cx={point.x} cy={point.y} r="5" fill="#FFFFFF" stroke={color} strokeWidth="3" />
        ))}
      </svg>
      <div className="grid grid-cols-7 gap-2 px-1 text-center text-xs font-semibold text-slate-500">
        {data.map((point) => (
          <span key={point.month}>{point.month}</span>
        ))}
      </div>
    </div>
  );
}
