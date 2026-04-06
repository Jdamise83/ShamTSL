import Link from "next/link";

import { PerformanceModuleView } from "@/components/dashboard/performance-module-view";
import { Button } from "@/components/ui/button";
import { shopifyService } from "@/server/services";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const DEFAULT_SHOP_DOMAIN = "cwu5dz-dz.myshopify.com";

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

function normalizeShopDomain(value: string): string {
  const raw = value.trim();
  if (!raw) {
    return "";
  }

  const cleaned = raw.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const storeMatch = cleaned.match(/admin\.shopify\.com\/store\/([^/]+)/i);
  if (storeMatch?.[1]) {
    return `${storeMatch[1].toLowerCase()}.myshopify.com`;
  }

  if (cleaned.includes(".myshopify.com")) {
    return cleaned.split("/")[0]?.toLowerCase() ?? "";
  }

  if (cleaned.includes(".")) {
    return "";
  }

  return `${cleaned.toLowerCase()}.myshopify.com`;
}

export default async function ShopifyPage(props: { searchParams?: SearchParams }) {
  const params = props.searchParams ? await props.searchParams : {};
  const connected = getParam(params, "shopify_connected") === "1";
  const errorMessage = getParam(params, "shopify_error");
  const data = await shopifyService.getDashboardData();
  const envShopDomain = normalizeShopDomain(process.env.SHOPIFY_STORE_DOMAIN ?? "");
  const connectShop = envShopDomain || DEFAULT_SHOP_DOMAIN;
  const connectHref = `/api/shopify/connect?shop=${encodeURIComponent(connectShop)}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild size="sm">
          <Link href={connectHref}>Connect Shopify</Link>
        </Button>
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
