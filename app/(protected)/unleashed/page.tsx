import { PerformanceModuleView } from "@/components/dashboard/performance-module-view";
import { unleashedService } from "@/server/services";

export default async function UnleashedPage() {
  const data = await unleashedService.getDashboardData();

  return (
    <PerformanceModuleView
      title="Unleashed"
      description="Commercial revenue and total profit dashboard across day, week-to-date, month-to-date, and YTD windows."
      data={data}
      splitTitle="Sales Mix"
      valuePrefix="£"
    />
  );
}
