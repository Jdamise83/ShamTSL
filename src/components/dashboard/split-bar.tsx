import type { PieSlice } from "@/types/dashboard";

interface SplitBarProps {
  data: PieSlice[];
}

export function SplitBar({ data }: SplitBarProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (!data.length || total === 0) {
    return <p className="text-sm text-muted-foreground">No split data available.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
        {data.map((item, index) => (
          <div
            key={item.label}
            style={{ width: `${(item.value / total) * 100}%` }}
            className={index % 2 === 0 ? "bg-primary" : "bg-primary/30"}
          />
        ))}
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {data.map((item, index) => (
          <div key={item.label} className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2">
            <span className="text-sm font-medium text-foreground">{item.label}</span>
            <span className={index % 2 === 0 ? "text-sm font-semibold text-primary" : "text-sm font-semibold text-foreground"}>
              {item.value}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
