import { PerformanceModuleView } from "@/components/dashboard/performance-module-view";
import { shopifyService } from "@/server/services";

export const dynamic = "force-dynamic";

export default async function ShopifyPage() {
  const data = await shopifyService.getDashboardData();

  return (
    <PerformanceModuleView
      title="Shopify"
      description="Store revenue, orders, and average order value across day, week-to-date, month-to-date, and YTD."
      data={data}
      splitTitle="Channel Split"
      valuePrefix=""
    />
  );
}
