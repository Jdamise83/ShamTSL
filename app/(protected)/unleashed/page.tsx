import { PerformanceModuleView } from "@/components/dashboard/performance-module-view";
import { unleashedService } from "@/server/services";

export default async function UnleashedPage() {
  const data = await unleashedService.getDashboardData();

  return (
    <PerformanceModuleView
      title="Unleashed"
      description="Commercial sales and profit dashboard across WTD, MTD, and YTD windows."
      data={data}
      splitTitle="Sales Mix"
    />
  );
}
