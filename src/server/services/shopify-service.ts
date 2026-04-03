import "server-only";

import type { ShopifyData } from "@/types/integrations";

type ShopifyConfig = {
  storeDomain: string;
  adminAccessToken: string;
  apiVersion: string;
  currency: string;
};

type ShopifyOrder = {
  processed_at?: string;
  current_total_price?: string;
  total_price?: string;
  currency?: string;
};

type ShopifyOrdersResponse = {
  orders?: ShopifyOrder[];
};

type ShopifyPeriod = {
  id: "day" | "week" | "month" | "ytd";
  label: "Day" | "Week to date" | "Month to date" | "YTD";
  startDate: string;
  endDate: string;
};

type ShopifyPeriodTotals = {
  id: ShopifyPeriod["id"];
  label: ShopifyPeriod["label"];
  revenue: number;
  orders: number;
  averageOrderValue: number;
};

const SHOPIFY_CACHE_TTL_MS = 5 * 60 * 1000;
const SHOPIFY_REQUEST_TIMEOUT_MS = 10000;
const SHOPIFY_PAGE_SIZE = 250;
const SHOPIFY_MAX_PAGES = 120;

let shopifyCache: { data: ShopifyData; expiresAt: number } | null = null;
let shopifyInFlight: Promise<ShopifyData> | null = null;

export interface ShopifyProvider {
  getDashboardData(): Promise<ShopifyData>;
}

class RealShopifyProvider implements ShopifyProvider {
  private readEnv(name: string, required = true) {
    const value = process.env[name]?.trim().replace(/^['"]|['"]$/g, "") ?? "";
    if (!value && required) {
      throw new Error(`Missing ${name}`);
    }
    return value;
  }

  private normalizeStoreDomain(rawDomain: string) {
    const noProtocol = rawDomain.replace(/^https?:\/\//i, "").replace(/\/+$/g, "");
    if (noProtocol.endsWith(".myshopify.com")) {
      return noProtocol;
    }
    return `${noProtocol}.myshopify.com`;
  }

  private getConfig(): ShopifyConfig {
    return {
      storeDomain: this.normalizeStoreDomain(this.readEnv("SHOPIFY_STORE_DOMAIN")),
      adminAccessToken: this.readEnv("SHOPIFY_ADMIN_ACCESS_TOKEN"),
      apiVersion: this.readEnv("SHOPIFY_API_VERSION", false) || "2025-01",
      currency: this.readEnv("SHOPIFY_CURRENCY", false) || "GBP"
    };
  }

  private toIsoDate(date: Date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private startOfUtcDay(date = new Date()) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  private startOfWeekMonday(date: Date) {
    const start = this.startOfUtcDay(date);
    const day = start.getUTCDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    start.setUTCDate(start.getUTCDate() - diffToMonday);
    return start;
  }

  private startOfMonth(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }

  private startOfYear(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  }

  private buildPeriods() {
    const today = this.startOfUtcDay();
    const endDate = this.toIsoDate(today);

    return [
      {
        id: "day",
        label: "Day",
        startDate: endDate,
        endDate
      },
      {
        id: "week",
        label: "Week to date",
        startDate: this.toIsoDate(this.startOfWeekMonday(today)),
        endDate
      },
      {
        id: "month",
        label: "Month to date",
        startDate: this.toIsoDate(this.startOfMonth(today)),
        endDate
      },
      {
        id: "ytd",
        label: "YTD",
        startDate: this.toIsoDate(this.startOfYear(today)),
        endDate
      }
    ] as const satisfies ShopifyPeriod[];
  }

  private formatCurrency(value: number, currency: string) {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  private formatNumber(value: number) {
    return value.toLocaleString("en-GB");
  }

  private parseNextLink(linkHeader: string | null) {
    if (!linkHeader) {
      return null;
    }

    const entries = linkHeader.split(",");
    for (const entry of entries) {
      if (!entry.includes('rel="next"')) {
        continue;
      }

      const match = entry.match(/<([^>]+)>/);
      if (match?.[1]) {
        return match[1];
      }
    }

    return null;
  }

  private toNumber(value: unknown) {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
  }

  private orderDateToIso(order: ShopifyOrder) {
    if (!order.processed_at) {
      return null;
    }

    const date = new Date(order.processed_at);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return this.toIsoDate(date);
  }

  private buildOrdersUrl(config: ShopifyConfig, processedAtMinDate: string, processedAtMaxDate: string) {
    const params = new URLSearchParams({
      status: "any",
      limit: String(SHOPIFY_PAGE_SIZE),
      processed_at_min: `${processedAtMinDate}T00:00:00Z`,
      processed_at_max: `${processedAtMaxDate}T23:59:59Z`,
      fields: "processed_at,current_total_price,total_price,currency"
    });

    return `https://${config.storeDomain}/admin/api/${config.apiVersion}/orders.json?${params.toString()}`;
  }

  private async fetchOrders(config: ShopifyConfig, processedAtMinDate: string, processedAtMaxDate: string) {
    const orders: ShopifyOrder[] = [];
    let nextUrl: string | null = this.buildOrdersUrl(config, processedAtMinDate, processedAtMaxDate);
    let page = 0;

    while (nextUrl && page < SHOPIFY_MAX_PAGES) {
      page += 1;

      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
      }, SHOPIFY_REQUEST_TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetch(nextUrl, {
          method: "GET",
          headers: {
            "X-Shopify-Access-Token": config.adminAccessToken,
            Accept: "application/json"
          },
          cache: "no-store",
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Shopify orders request failed (${response.status}): ${body || response.statusText}`);
      }

      const payload = (await response.json()) as ShopifyOrdersResponse;
      orders.push(...(payload.orders ?? []));
      nextUrl = this.parseNextLink(response.headers.get("link"));
    }

    return orders;
  }

  private aggregatePeriod(period: ShopifyPeriod, orders: ShopifyOrder[]) {
    let revenue = 0;
    let orderCount = 0;

    for (const order of orders) {
      const orderDate = this.orderDateToIso(order);
      if (!orderDate || orderDate < period.startDate || orderDate > period.endDate) {
        continue;
      }

      const orderRevenue = this.toNumber(order.current_total_price ?? order.total_price);
      revenue += orderRevenue;
      orderCount += 1;
    }

    const averageOrderValue = orderCount > 0 ? revenue / orderCount : 0;
    return {
      id: period.id,
      label: period.label,
      revenue,
      orders: orderCount,
      averageOrderValue
    } satisfies ShopifyPeriodTotals;
  }

  private buildDashboardData(periods: ShopifyPeriodTotals[], config: ShopifyConfig): ShopifyData {
    return {
      kpiGroups: periods.map((period) => ({
        id: `shopify-${period.id}`,
        label: period.label,
        metrics: [
          {
            id: `shopify-revenue-${period.id}`,
            label: "Revenue",
            value: this.formatCurrency(period.revenue, config.currency),
            change: undefined
          },
          {
            id: `shopify-orders-${period.id}`,
            label: "Orders",
            value: this.formatNumber(period.orders),
            change: undefined
          },
          {
            id: `shopify-aov-${period.id}`,
            label: "Average Order Value",
            value: this.formatCurrency(period.averageOrderValue, config.currency),
            change: undefined
          }
        ]
      })),
      charts: {
        trend: periods.map((period) => ({
          label:
            period.id === "day"
              ? "Day"
              : period.id === "week"
                ? "WTD"
                : period.id === "month"
                  ? "MTD"
                  : "YTD",
          value: Number(period.revenue.toFixed(2))
        })),
        split: []
      },
      tables: [
        {
          key: "shopify-period-performance",
          title: "Shopify Revenue Performance",
          rows: periods.map((period) => ({
            Period: period.label,
            Revenue: this.formatCurrency(period.revenue, config.currency),
            Orders: this.formatNumber(period.orders),
            "Average Order Value": this.formatCurrency(period.averageOrderValue, config.currency)
          }))
        }
      ]
    };
  }

  private fallback(): ShopifyData {
    const labels = ["Day", "Week to date", "Month to date", "YTD"] as const;

    return {
      kpiGroups: labels.map((label) => ({
        id: `shopify-${label.toLowerCase().replace(/\s+/g, "-")}`,
        label,
        metrics: [
          { id: `shopify-revenue-${label}`, label: "Revenue", value: "-", change: undefined },
          { id: `shopify-orders-${label}`, label: "Orders", value: "-", change: undefined },
          { id: `shopify-aov-${label}`, label: "Average Order Value", value: "-", change: undefined }
        ]
      })),
      charts: {
        trend: [
          { label: "Day", value: 0 },
          { label: "WTD", value: 0 },
          { label: "MTD", value: 0 },
          { label: "YTD", value: 0 }
        ],
        split: []
      },
      tables: [
        {
          key: "shopify-period-performance",
          title: "Shopify Revenue Performance",
          rows: [
            { Period: "Day", Revenue: "-", Orders: "-", "Average Order Value": "-" },
            { Period: "Week to date", Revenue: "-", Orders: "-", "Average Order Value": "-" },
            { Period: "Month to date", Revenue: "-", Orders: "-", "Average Order Value": "-" },
            { Period: "YTD", Revenue: "-", Orders: "-", "Average Order Value": "-" }
          ]
        }
      ]
    };
  }

  private async getFreshDashboardData() {
    const config = this.getConfig();
    const periods = this.buildPeriods();
    const earliestStartDate = periods[periods.length - 1]?.startDate ?? periods[0].startDate;
    const latestEndDate = periods[0].endDate;
    const orders = await this.fetchOrders(config, earliestStartDate, latestEndDate);
    const totals = periods.map((period) => this.aggregatePeriod(period, orders));
    return this.buildDashboardData(totals, config);
  }

  async getDashboardData(): Promise<ShopifyData> {
    if (shopifyCache && Date.now() < shopifyCache.expiresAt) {
      return shopifyCache.data;
    }

    if (!shopifyInFlight) {
      shopifyInFlight = this.getFreshDashboardData();
    }

    try {
      const data = await shopifyInFlight;
      shopifyCache = {
        data,
        expiresAt: Date.now() + SHOPIFY_CACHE_TTL_MS
      };
      return data;
    } catch (error) {
      console.error("[Shopify] Runtime error. Falling back to empty values.", {
        hasStoreDomain: Boolean(process.env.SHOPIFY_STORE_DOMAIN?.trim()),
        hasAdminAccessToken: Boolean(process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim()),
        error: error instanceof Error ? error.message : String(error)
      });
      if (shopifyCache) {
        return shopifyCache.data;
      }
      return this.fallback();
    } finally {
      shopifyInFlight = null;
    }
  }
}

class FallbackShopifyProvider implements ShopifyProvider {
  private fallbackData: ShopifyData = {
    kpiGroups: [],
    charts: { trend: [], split: [] },
    tables: []
  };

  async getDashboardData(): Promise<ShopifyData> {
    return this.fallbackData;
  }
}

export class ShopifyService {
  constructor(private readonly provider: ShopifyProvider) {}

  async getDashboardData() {
    return this.provider.getDashboardData();
  }
}

function resolveShopifyProvider(): ShopifyProvider {
  const hasCredentials = Boolean(
    process.env.SHOPIFY_STORE_DOMAIN?.trim() && process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim()
  );

  if (!hasCredentials) {
    console.warn("[Shopify] Missing credentials. Returning fallback values.");
    return new FallbackShopifyProvider();
  }

  return new RealShopifyProvider();
}

export const shopifyService = new ShopifyService(resolveShopifyProvider());
