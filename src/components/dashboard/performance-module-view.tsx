import { ChartCard } from "@/components/dashboard/chart-card";
import { DataTable } from "@/components/dashboard/data-table";
import { ModuleKpiGroups } from "@/components/dashboard/module-kpi-groups";
import { SectionHeader } from "@/components/dashboard/section-header";
import { LineTrendChart } from "@/components/dashboard/line-trend-chart";
import { SplitBar } from "@/components/dashboard/split-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PerformanceModuleData } from "@/types/integrations";

interface PerformanceModuleViewProps {
  title: string;
  description: string;
  data: PerformanceModuleData;
  splitTitle?: string;
  valuePrefix?: string;
}

export function PerformanceModuleView({
  title,
  description,
  data,
  splitTitle = "Branded vs Non-Branded",
  valuePrefix
}: PerformanceModuleViewProps) {
  return (
    <div className="space-y-8">
      <SectionHeader title={title} description={description} />

      <ModuleKpiGroups groups={data.kpiGroups} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard title="Performance Trend" subtitle="Period trend line" >
          <LineTrendChart data={data.charts.trend} valuePrefix={valuePrefix} />
        </ChartCard>
        <Card className="border-border/80 bg-card">
          <CardHeader>
            <CardTitle className="text-base uppercase tracking-[0.08em]">{splitTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <SplitBar data={data.charts.split ?? []} />
          </CardContent>
        </Card>
      </div>

      <section className="space-y-4">
        {data.tables.map((tableBlock) => (
          <details key={tableBlock.key} open className="rounded-2xl border border-border/80 bg-card p-5 shadow-card">
            <summary className="cursor-pointer select-none font-heading text-sm font-semibold uppercase tracking-[0.08em] text-foreground">
              {tableBlock.title}
            </summary>
            <div className="mt-4">
              <DataTable rows={tableBlock.rows} />
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}
