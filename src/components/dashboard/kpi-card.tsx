import { Card, CardContent } from "@/components/ui/card";
import { ComparisonIndicator } from "@/components/dashboard/comparison-indicator";
import type { KpiMetric } from "@/types/dashboard";

interface KpiCardProps {
  metric: KpiMetric;
}

export function KpiCard({ metric }: KpiCardProps) {
  return (
    <Card className="min-h-36 border-border/80 bg-card">
      <CardContent className="flex h-full flex-col justify-between p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{metric.label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{metric.value}</p>
        </div>
        <div className="mt-4 space-y-2">
          {metric.change ? <ComparisonIndicator change={metric.change} /> : null}
          {metric.helperText ? <p className="text-xs text-muted-foreground">{metric.helperText}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
