import { PerformanceModuleView } from "@/components/dashboard/performance-module-view";
import { ga4Service } from "@/server/services";

export default async function Ga4Page() {
  const data = await ga4Service.getDashboardData();

  return (
    <PerformanceModuleView
      title="GA4"
      description="Sessions, users, revenue and purchases with channel and conversion context."
      data={data}
      valuePrefix=""
      splitTitle="Device Split"
    />
  );
}
