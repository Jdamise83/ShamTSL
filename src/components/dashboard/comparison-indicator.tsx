import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ChangeMetric } from "@/types/dashboard";

interface ComparisonIndicatorProps {
  change: ChangeMetric;
  className?: string;
}

export function ComparisonIndicator({ change, className }: ComparisonIndicatorProps) {
  const Icon =
    change.direction === "up" ? ArrowUpRight : change.direction === "down" ? ArrowDownRight : ArrowRight;

  const colorClass =
    change.direction === "up"
      ? "text-success"
      : change.direction === "down"
      ? "text-danger"
      : "text-muted-foreground";

  return (
    <p className={cn("flex items-center gap-1 text-xs font-semibold", colorClass, className)}>
      <Icon className="h-3.5 w-3.5" />
      {change.value}% {change.label ?? "vs previous period"}
    </p>
  );
}
