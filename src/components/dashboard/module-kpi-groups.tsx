import { RangeLabel } from "@/components/dashboard/range-label";
import { KpiCard } from "@/components/dashboard/kpi-card";
import type { KpiGroup } from "@/types/dashboard";

interface ModuleKpiGroupsProps {
  groups: KpiGroup[];
}

export function ModuleKpiGroups({ groups }: ModuleKpiGroupsProps) {
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.id} className="space-y-3">
          <RangeLabel label={group.label} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {group.metrics.map((metric) => (
              <KpiCard key={metric.id} metric={metric} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
