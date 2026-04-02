import { PerformanceModuleView } from "@/components/dashboard/performance-module-view";
import { googleAdsService } from "@/server/services";

export const dynamic = "force-dynamic";

export default async function GoogleAdsPage() {
  const data = await googleAdsService.getDashboardData();

  return (
    <PerformanceModuleView
      title="Google Ads"
      description="Grouped KPI rows with campaign and search term breakdowns."
      data={data}
      splitTitle="Top Selling Products"
      valuePrefix=""
    />
  );
}
