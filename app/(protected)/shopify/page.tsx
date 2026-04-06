import { PerformanceModuleView } from "@/components/dashboard/performance-module-view";
import { shopifyService } from "@/server/services";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const dynamic = "force-dynamic";

function getParam(
  source: Record<string, string | string[] | undefined>,
  key: string
): string {
  const value = source[key];
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function ShopifyPage(props: { searchParams?: SearchParams }) {
  const params = props.searchParams ? await props.searchParams : {};
  const connected = getParam(params, "shopify_connected") === "1";
  const errorMessage = getParam(params, "shopify_error");
  const data = await shopifyService.getDashboardData();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground">Shopify sync uses app credentials automatically.</p>
        {connected ? (
          <p className="text-sm text-emerald-700">Shopify connected. Live sync enabled.</p>
        ) : null}
        {errorMessage ? (
          <p className="text-sm text-red-700">Shopify connection error: {errorMessage}</p>
        ) : null}
      </div>

      <PerformanceModuleView
        title="Shopify"
        description="MTD revenue/orders, customer lifetime value, channel acquisition quality, and US vs UK revenue."
        data={data}
        splitTitle="US vs UK Revenue (MTD)"
        valuePrefix=""
      />
    </div>
  );
}
