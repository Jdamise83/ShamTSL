import { PerformanceModuleView } from "@/components/dashboard/performance-module-view";
import { ga4Service } from "@/server/services";

export default async function Ga4Page() {
  const data = await ga4Service.getDashboardData();

  return (
    <PerformanceModuleView
      title="GA4"
      description="Last 30 days of users, sessions, revenue, monthly performance trend, and acquisition mix."
      data={data}
      valuePrefix=""
      splitTitle="Acquisition Split (Last 30 Days)"
    />
  );
}