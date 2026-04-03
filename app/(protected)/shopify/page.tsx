import { PerformanceModuleView } from "@/components/dashboard/performance-module-view";
import { shopifyService } from "@/server/services";

export default async function ShopifyPage() {
  const data = await shopifyService.getDashboardData();

  return (
    <PerformanceModuleView
      title="Shopify"
      description="Orders today health check with day, last 7 days, and month-to-date order/revenue summary."
      data={data}
      splitTitle="Channel Split"
      valuePrefix=""
    />
  );
}
