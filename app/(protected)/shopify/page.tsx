import { PerformanceModuleView } from "@/components/dashboard/performance-module-view";
import { shopifyService } from "@/server/services";

export default async function ShopifyPage() {
  const data = await shopifyService.getDashboardData();

  return (
    <PerformanceModuleView
      title="Shopify"
      description="MTD revenue/orders, customer lifetime value, channel acquisition quality, and US vs UK revenue."
      data={data}
      splitTitle="US vs UK Revenue (MTD)"
      valuePrefix=""
    />
  );
}
