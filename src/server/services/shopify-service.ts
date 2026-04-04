import "server-only";

import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { cookies } from "next/headers";

import type { LinePoint } from "@/types/dashboard";
import type { ShopifyData } from "@/types/integrations";

type PeriodKey = "day" | "last7" | "mtd" | "ytd";
type AcquisitionChannel = "google_ads" | "unbranded_seo";

interface PeriodSummary {
  key: PeriodKey;
  label: string;
  revenue: number;
  orders: number;
}

interface DerivedMetrics {
  customerLifetimeValue: number;
  customerAverageLifetimeOrders: number;
  googleAdsFirstOrderAov: number;
  googleAdsLtv: number;
  unbrandedSeoFirstOrderAov: number;
  unbrandedSeoLtv: number;
  usRevenueMtd: number;
  ukRevenueMtd: number;
}

interface AppEndpointConfig {
  endpoint: string;
  clientId: string;
  clientSecret: string;
  currency: string;
  timeoutMs: number;
}

interface ShopifyApiConfig {
  shopDomain: string;
  clientId: string;
  clientSecret: string;
  allowTokenExchange: boolean;
  adminAccessToken?: string;
  apiVersion: string;
  currency: string;
  timeoutMs: number;
}

interface RuntimeConfig {
  appEndpoint: AppEndpointConfig | null;
  shopifyApi: ShopifyApiConfig | null;
}

interface CacheEntry {
  data: ShopifyData;
  expiresAt: number;
  authFingerprint: string;
}

interface TokenCacheEntry {
  token: string;
  expiresAt: number;
}

interface ShopifyOrder {
  createdAt: string;
  revenue: number;
  customerId: string | null;
  customerLifetimeValue: number | null;
  customerLifetimeOrders: number | null;
  landingPageUrl: string;
  referringSite: string;
  countryCode: string;
}

interface GraphqlOrderEdge {
  node?: {
    createdAt?: string;
    currentTotalPriceSet?: {
      shopMoney?: {
        amount?: string;
      };
    };
    totalPriceSet?: {
      shopMoney?: {
        amount?: string;
      };
    };
    landingPageUrl?: string;
    referringSite?: string;
    shippingAddress?: {
      countryCodeV2?: string;
    };
    billingAddress?: {
      countryCodeV2?: string;
    };
    customer?: {
      id?: string;
      numberOfOrders?: number;
      amountSpent?: {
        amount?: string;
      };
    };
  };
}

interface GraphqlOrdersResponse {
  data?: {
    orders?: {
      edges?: GraphqlOrderEdge[];
      pageInfo?: {
        hasNextPage?: boolean;
        endCursor?: string;
      };
    };
  };
  errors?: Array<{ message?: string }>;
}

type ChannelCounts = Record<AcquisitionChannel, number>;

interface Ga4AttributionSignals {
  totals: ChannelCounts;
  byPath: Map<string, ChannelCounts>;
}

const PERIODS: Array<{ key: PeriodKey; label: string }> = [
  { key: "day", label: "Day" },
  { key: "last7", label: "Last 7 days" },
  { key: "mtd", label: "Month to date" },
  { key: "ytd", label: "YTD" }
];

const BRAND_TERMS = ["snus life", "snuslife", "the snus life", "thesnuslife"];

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_API_VERSION = "2025-01";
const DATA_CACHE_TTL_MS = 2 * 60_000;

function readEnv(names: string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) {
      return value;
    }
  }

  return "";
}

function isTruthyFlag(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function normalizeShopDomain(value: string): string {
  const clean = value.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  if (!clean) {
    return "";
  }

  if (clean.includes(".")) {
    return clean;
  }

  return `${clean}.myshopify.com`;
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function looksLikeShopifyAccessToken(value: string): boolean {
  const token = value.trim();
  if (!token) {
    return false;
  }

  return /^shpat_|^shppa_|^shpca_/.test(token);
}

async function readShopifyAccessTokenFromCookie(): Promise<string> {
  try {
    const cookieStore = await cookies();
    const token =
      cookieStore.get("shopify_admin_access_token")?.value ??
      cookieStore.get("shopify_access_token")?.value ??
      "";

    return token.trim();
  } catch {
    return "";
  }
}

function getAuthFingerprint(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) {
    return "none";
  }

  return `${trimmed.slice(0, 10)}:${trimmed.length}`;
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency || "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number.isFinite(value) ? value : 0);
}

function formatNumber(value: number) {
  return Math.round(Number.isFinite(value) ? value : 0).toLocaleString("en-GB");
}

function initChannelCounts(): ChannelCounts {
  return {
    google_ads: 0,
    unbranded_seo: 0
  };
}

function pickDominantChannel(counts: ChannelCounts): AcquisitionChannel | null {
  if (counts.google_ads === counts.unbranded_seo) {
    return null;
  }

  return counts.google_ads > counts.unbranded_seo ? "google_ads" : "unbranded_seo";
}

function normalizeLandingPath(rawPath: string): string {
  const raw = rawPath.trim();
  if (!raw) {
    return "";
  }

  try {
    const parsed = raw.includes("://") ? new URL(raw) : new URL(raw, "https://example.com");
    const pathname = parsed.pathname.toLowerCase().replace(/\/+$/, "");
    return pathname || "/";
  } catch {
    return "";
  }
}

function getBoundaries(now = new Date()) {
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const last7Start = new Date(dayStart);
  last7Start.setUTCDate(last7Start.getUTCDate() - 6);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const fetchStart = new Date(Math.min(last7Start.getTime(), monthStart.getTime(), yearStart.getTime()));

  return { now, dayStart, last7Start, monthStart, yearStart, fetchStart };
}

function emptyDerivedMetrics(): DerivedMetrics {
  return {
    customerLifetimeValue: 0,
    customerAverageLifetimeOrders: 0,
    googleAdsFirstOrderAov: 0,
    googleAdsLtv: 0,
    unbrandedSeoFirstOrderAov: 0,
    unbrandedSeoLtv: 0,
    usRevenueMtd: 0,
    ukRevenueMtd: 0
  };
}

function blankData(): ShopifyData {
  return {
    kpiGroups: [
      {
        id: "shopify-overview",
        label: "Shopify MTD Overview",
        metrics: [
          { id: "shopify_revenue_mtd", label: "Total revenue MTD", value: "-" },
          { id: "shopify_orders_mtd", label: "Month to date orders", value: "-" },
          { id: "shopify_customer_ltv", label: "Customer Lifetime value", value: "-" },
          {
            id: "shopify_customer_lifetime_orders",
            label: "Customer average lifetime orders",
            value: "-"
          }
        ]
      },
      {
        id: "shopify-acquisition",
        label: "Acquisition Cohorts",
        metrics: [
          {
            id: "shopify_google_ads_first_order_aov",
            label: "Customer AOV first order from Google Ads",
            value: "-"
          },
          {
            id: "shopify_google_ads_ltv",
            label: "Customer LTV from Google Ads",
            value: "-"
          },
          {
            id: "shopify_unbranded_seo_first_order_aov",
            label: "Customer AOV first order from Unbranded SEO",
            value: "-"
          },
          {
            id: "shopify_unbranded_seo_ltv",
            label: "Customer LTV from Unbranded SEO",
            value: "-"
          }
        ]
      },
      {
        id: "shopify-country-mtd",
        label: "Total Revenue by Country (MTD)",
        metrics: [
          { id: "shopify_us_revenue_mtd", label: "US revenue MTD", value: "-" },
          { id: "shopify_uk_revenue_mtd", label: "UK revenue MTD", value: "-" }
        ]
      }
    ],
    charts: {
      trend: [],
      split: []
    },
    tables: [
      {
        key: "shopify-financial-performance",
        title: "Financial Performance",
        rows: PERIODS.map((period) => ({
          period: period.label,
          revenue: "-",
          orders: "-",
          aov: "-"
        }))
      }
    ]
  };
}

function buildData(periods: PeriodSummary[], metrics: DerivedMetrics, currency: string): ShopifyData {
  const mtd = periods.find((period) => period.key === "mtd");

  const trend: LinePoint[] = periods.map((period) => ({
    label: period.key === "last7" ? "Last 7D" : period.key.toUpperCase(),
    value: period.revenue
  }));

  return {
    kpiGroups: [
      {
        id: "shopify-overview",
        label: "Shopify MTD Overview",
        metrics: [
          {
            id: "shopify_revenue_mtd",
            label: "Total revenue MTD",
            value: formatCurrency(mtd?.revenue ?? 0, currency)
          },
          {
            id: "shopify_orders_mtd",
            label: "Month to date orders",
            value: formatNumber(mtd?.orders ?? 0)
          },
          {
            id: "shopify_customer_ltv",
            label: "Customer Lifetime value",
            value: formatCurrency(metrics.customerLifetimeValue, currency)
          },
          {
            id: "shopify_customer_lifetime_orders",
            label: "Customer average lifetime orders",
            value: metrics.customerAverageLifetimeOrders.toFixed(2)
          }
        ]
      },
      {
        id: "shopify-acquisition",
        label: "Acquisition Cohorts",
        metrics: [
          {
            id: "shopify_google_ads_first_order_aov",
            label: "Customer AOV first order from Google Ads",
            value: formatCurrency(metrics.googleAdsFirstOrderAov, currency)
          },
          {
            id: "shopify_google_ads_ltv",
            label: "Customer LTV from Google Ads",
            value: formatCurrency(metrics.googleAdsLtv, currency)
          },
          {
            id: "shopify_unbranded_seo_first_order_aov",
            label: "Customer AOV first order from Unbranded SEO",
            value: formatCurrency(metrics.unbrandedSeoFirstOrderAov, currency)
          },
          {
            id: "shopify_unbranded_seo_ltv",
            label: "Customer LTV from Unbranded SEO",
            value: formatCurrency(metrics.unbrandedSeoLtv, currency)
          }
        ]
      },
      {
        id: "shopify-country-mtd",
        label: "Total Revenue by Country (MTD)",
        metrics: [
          {
            id: "shopify_us_revenue_mtd",
            label: "US revenue MTD",
            value: formatCurrency(metrics.usRevenueMtd, currency)
          },
          {
            id: "shopify_uk_revenue_mtd",
            label: "UK revenue MTD",
            value: formatCurrency(metrics.ukRevenueMtd, currency)
          }
        ]
      }
    ],
    charts: {
      trend,
      split: [
        { label: "US", value: metrics.usRevenueMtd },
        { label: "UK", value: metrics.ukRevenueMtd }
      ]
    },
    tables: [
      {
        key: "shopify-financial-performance",
        title: "Financial Performance",
        rows: periods.map((period) => {
          const aov = period.orders > 0 ? period.revenue / period.orders : 0;

          return {
            period: period.label,
            revenue: formatCurrency(period.revenue, currency),
            orders: formatNumber(period.orders),
            aov: formatCurrency(aov, currency)
          };
        })
      },
      {
        key: "shopify-acquisition-performance",
        title: "Acquisition Performance",
        rows: [
          {
            channel: "Google Ads",
            firstOrderAov: formatCurrency(metrics.googleAdsFirstOrderAov, currency),
            customerLtv: formatCurrency(metrics.googleAdsLtv, currency)
          },
          {
            channel: "Unbranded SEO",
            firstOrderAov: formatCurrency(metrics.unbrandedSeoFirstOrderAov, currency),
            customerLtv: formatCurrency(metrics.unbrandedSeoLtv, currency)
          }
        ]
      }
    ]
  };
}

function resolveConfig(): RuntimeConfig {
  const clientId = readEnv([
    "SHOPIFY_APP_CLIENT_ID",
    "SHOPIFY_CLIENT_ID",
    "SHOPIFY_API_KEY",
    "SHOPIFY_KEY",
    "SHOPIFY_PUBLIC_API_KEY"
  ]);
  const clientSecret = readEnv([
    "SHOPIFY_APP_CLIENT_SECRET",
    "SHOPIFY_CLIENT_SECRET",
    "SHOPIFY_API_SECRET",
    "SHOPIFY_SECRET_KEY",
    "SHOPIFY_SECRET",
    "SHOPIFY_API_PASSWORD"
  ]);
  const appEndpoint = readEnv([
    "SHOPIFY_APP_METRICS_ENDPOINT",
    "SHOPIFY_METRICS_ENDPOINT",
    "SHOPIFY_APP_ENDPOINT",
    "SHOPIFY_ENDPOINT"
  ]);

  const shopDomainRaw = readEnv([
    "SHOPIFY_STORE_DOMAIN",
    "SHOPIFY_SHOP_DOMAIN",
    "SHOPIFY_SHOP",
    "SHOPIFY_DOMAIN",
    "SHOPIFY_MYSHOPIFY_DOMAIN",
    "SHOPIFY_STORE_ID"
  ]);
  const shopDomain = normalizeShopDomain(shopDomainRaw);
  const adminAccessToken = readEnv([
    "SHOPIFY_ADMIN_ACCESS_TOKEN",
    "SHOPIFY_ACCESS_TOKEN",
    "SHOPIFY_ADMIN_API_ACCESS_TOKEN",
    "SHOPIFY_APP_ACCESS_TOKEN",
    "SHOPIFY_TOKEN",
    "SHOPIFY_PRIVATE_TOKEN"
  ]);
  const apiVersion = readEnv(["SHOPIFY_API_VERSION"]) || DEFAULT_API_VERSION;
  const currency = (readEnv(["SHOPIFY_CURRENCY"]) || "GBP").toUpperCase();
  const timeoutRaw = readEnv(["SHOPIFY_APP_TIMEOUT_MS", "SHOPIFY_TIMEOUT_MS"]);
  const allowTokenExchange = isTruthyFlag(readEnv(["SHOPIFY_ENABLE_TOKEN_EXCHANGE"]));
  const timeout = Number(timeoutRaw);
  const timeoutMs = Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_TIMEOUT_MS;

  const endpointConfig =
    appEndpoint && clientId && clientSecret
      ? {
          endpoint: appEndpoint,
          clientId,
          clientSecret,
          currency,
          timeoutMs
        }
      : null;

  const shopifyApiConfig =
    shopDomain && clientId && clientSecret
      ? {
          shopDomain,
          clientId,
          clientSecret,
          allowTokenExchange,
          adminAccessToken: adminAccessToken || undefined,
          apiVersion,
          currency,
          timeoutMs
        }
      : null;

  return {
    appEndpoint: endpointConfig,
    shopifyApi: shopifyApiConfig
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getByPath(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!isRecord(current)) {
      return undefined;
    }

    return current[key];
  }, source);
}

function isShopifyDataPayload(payload: unknown): payload is ShopifyData {
  if (!isRecord(payload)) {
    return false;
  }

  return Array.isArray(payload.kpiGroups) && isRecord(payload.charts) && Array.isArray(payload.tables);
}

function parseAppPayload(payload: unknown, currency: string): ShopifyData {
  if (isShopifyDataPayload(payload)) {
    return payload;
  }

  const periods: PeriodSummary[] = PERIODS.map((period) => ({
    key: period.key,
    label: period.label,
    revenue: 0,
    orders: 0
  }));

  const periodRows =
    (getByPath(payload, "periods") as unknown[]) ??
    (getByPath(payload, "data.periods") as unknown[]) ??
    (getByPath(payload, "summary.periods") as unknown[]) ??
    [];

  if (Array.isArray(periodRows)) {
    for (const row of periodRows) {
      if (!isRecord(row)) {
        continue;
      }

      const rawKey = String(row.period ?? row.key ?? row.label ?? row.id ?? "")
        .toLowerCase()
        .replace(/\s+/g, "_");

      const periodKey: PeriodKey | null =
        rawKey === "day" || rawKey === "today"
          ? "day"
          : rawKey === "last7" || rawKey === "last_7_days" || rawKey === "week" || rawKey === "wtd"
            ? "last7"
            : rawKey === "mtd" || rawKey === "month" || rawKey === "month_to_date"
              ? "mtd"
              : rawKey === "ytd" || rawKey === "year" || rawKey === "year_to_date" || rawKey === "this_year"
                ? "ytd"
                : null;

      if (!periodKey) {
        continue;
      }

      const period = periods.find((item) => item.key === periodKey);
      if (!period) {
        continue;
      }

      period.revenue = toNumber(row.revenue ?? row.totalRevenue ?? row.sales ?? row.amount ?? 0);
      period.orders = toNumber(row.orders ?? row.orderCount ?? row.count ?? 0);
    }
  }

  return buildData(periods, emptyDerivedMetrics(), currency);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchFromAppEndpoint(config: AppEndpointConfig): Promise<ShopifyData> {
  const url = new URL(config.endpoint);
  url.searchParams.set("periods", "day,last7,mtd,ytd");

  const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");

  const response = await fetchWithTimeout(
    url.toString(),
    {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${basic}`,
        "X-Client-Id": config.clientId,
        "X-Client-Secret": config.clientSecret,
        "X-API-Key": config.clientId,
        "X-API-Secret": config.clientSecret
      }
    },
    config.timeoutMs
  );

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`App endpoint ${response.status}: ${text.slice(0, 200)}`);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text) as unknown;
  } catch {
    throw new Error("App endpoint did not return JSON.");
  }

  return parseAppPayload(payload, config.currency);
}

async function exchangeToken(config: ShopifyApiConfig): Promise<TokenCacheEntry> {
  const url = `https://${config.shopDomain}/admin/oauth/access_token`;

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "client_credentials"
  });

  const response = await fetchWithTimeout(
    url,
    {
      method: "POST",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: body.toString()
    },
    config.timeoutMs
  );

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Token exchange ${response.status}: ${text.slice(0, 220)}`);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text) as unknown;
  } catch {
    throw new Error("Token exchange returned non-JSON.");
  }

  if (!isRecord(payload)) {
    throw new Error("Token exchange returned invalid payload.");
  }

  const token = typeof payload.access_token === "string" ? payload.access_token.trim() : "";
  const expiresIn = toNumber(payload.expires_in);

  if (!token) {
    throw new Error("Token exchange returned empty access_token.");
  }

  const ttlMs = expiresIn > 60 ? (expiresIn - 60) * 1000 : 20 * 60 * 1000;
  return {
    token,
    expiresAt: Date.now() + ttlMs
  };
}

async function fetchOrdersWithQuery(
  config: ShopifyApiConfig,
  accessToken: string,
  query: string,
  lightweight = false
): Promise<ShopifyOrder[]> {
  const endpoint = `https://${config.shopDomain}/admin/api/${config.apiVersion}/graphql.json`;
  const { fetchStart } = getBoundaries();
  const queryFilter = `created_at:>=${fetchStart.toISOString()}`;

  const orders: ShopifyOrder[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;
  let pageCount = 0;

  while (hasNextPage && pageCount < 20) {
    pageCount += 1;

    const response = await fetchWithTimeout(
      endpoint,
      {
        method: "POST",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken
        },
        body: JSON.stringify({
          query,
          variables: {
            first: 250,
            after: cursor,
            query: queryFilter
          }
        })
      },
      config.timeoutMs
    );

    const payload = (await response.json()) as GraphqlOrdersResponse;
    const hasOrderData = Array.isArray(payload.data?.orders?.edges);

    if (!response.ok) {
      const message = payload.errors?.[0]?.message ?? "Unknown GraphQL error";
      throw new Error(`GraphQL ${response.status}: ${message}`);
    }

    if (payload.errors?.length && !hasOrderData) {
      throw new Error(payload.errors[0]?.message ?? "GraphQL query failed.");
    }

    if (payload.errors?.length && hasOrderData) {
      console.warn("[Shopify] GraphQL returned partial data with field errors. Continuing with available order data.", {
        firstError: payload.errors[0]?.message
      });
    }

    const edges = payload.data?.orders?.edges ?? [];
    for (const edge of edges) {
      const node = edge.node;
      const createdAt = node?.createdAt;
      if (!createdAt) {
        continue;
      }

      const revenue = toNumber(node?.currentTotalPriceSet?.shopMoney?.amount ?? node?.totalPriceSet?.shopMoney?.amount ?? 0);

      orders.push({
        createdAt,
        revenue,
        customerId: lightweight ? null : (node?.customer?.id ?? null),
        customerLifetimeValue:
          lightweight || node?.customer?.amountSpent?.amount === undefined
            ? null
            : toNumber(node?.customer?.amountSpent?.amount),
        customerLifetimeOrders:
          lightweight || node?.customer?.numberOfOrders === undefined || node?.customer?.numberOfOrders === null
            ? null
            : toNumber(node?.customer?.numberOfOrders),
        landingPageUrl: lightweight ? "" : (node?.landingPageUrl ?? ""),
        referringSite: lightweight ? "" : (node?.referringSite ?? ""),
        countryCode: lightweight
          ? ""
          : String(node?.shippingAddress?.countryCodeV2 ?? node?.billingAddress?.countryCodeV2 ?? "")
              .toUpperCase()
              .trim()
      });
    }

    hasNextPage = Boolean(payload.data?.orders?.pageInfo?.hasNextPage);
    cursor = payload.data?.orders?.pageInfo?.endCursor ?? null;
  }

  return orders;
}

async function fetchOrders(config: ShopifyApiConfig, accessToken: string): Promise<ShopifyOrder[]> {
  const richQuery = `
    query DashboardOrders($first: Int!, $after: String, $query: String!) {
      orders(first: $first, after: $after, query: $query, sortKey: CREATED_AT, reverse: true) {
        edges {
          node {
            createdAt
            currentTotalPriceSet { shopMoney { amount } }
            totalPriceSet { shopMoney { amount } }
            landingPageUrl
            referringSite
            shippingAddress { countryCodeV2 }
            billingAddress { countryCodeV2 }
            customer {
              id
              numberOfOrders
              amountSpent { amount }
            }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  `;

  const lightweightQuery = `
    query DashboardOrdersLite($first: Int!, $after: String, $query: String!) {
      orders(first: $first, after: $after, query: $query, sortKey: CREATED_AT, reverse: true) {
        edges {
          node {
            createdAt
            currentTotalPriceSet { shopMoney { amount } }
            totalPriceSet { shopMoney { amount } }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  `;

  try {
    return await fetchOrdersWithQuery(config, accessToken, richQuery, false);
  } catch (error) {
    console.warn("[Shopify] Rich order query failed. Falling back to lightweight query.", {
      error: error instanceof Error ? error.message : String(error)
    });
    return fetchOrdersWithQuery(config, accessToken, lightweightQuery, true);
  }
}

function aggregatePeriods(orders: ShopifyOrder[]): PeriodSummary[] {
  const { now, dayStart, last7Start, monthStart, yearStart } = getBoundaries();

  const summary = new Map<PeriodKey, PeriodSummary>(
    PERIODS.map((period) => [
      period.key,
      { key: period.key, label: period.label, revenue: 0, orders: 0 }
    ])
  );

  for (const order of orders) {
    const createdAt = new Date(order.createdAt);
    if (Number.isNaN(createdAt.getTime()) || createdAt > now) {
      continue;
    }

    if (createdAt >= dayStart) {
      const day = summary.get("day");
      if (day) {
        day.revenue += order.revenue;
        day.orders += 1;
      }
    }

    if (createdAt >= last7Start) {
      const last7 = summary.get("last7");
      if (last7) {
        last7.revenue += order.revenue;
        last7.orders += 1;
      }
    }

    if (createdAt >= monthStart) {
      const mtd = summary.get("mtd");
      if (mtd) {
        mtd.revenue += order.revenue;
        mtd.orders += 1;
      }
    }

    if (createdAt >= yearStart) {
      const ytd = summary.get("ytd");
      if (ytd) {
        ytd.revenue += order.revenue;
        ytd.orders += 1;
      }
    }
  }

  return PERIODS.map((period) => summary.get(period.key)).filter((item): item is PeriodSummary => Boolean(item));
}

function containsBrand(text: string) {
  const lower = text.toLowerCase();
  return BRAND_TERMS.some((term) => lower.includes(term));
}

function parseSearchParams(rawUrl: string) {
  if (!rawUrl) {
    return new URLSearchParams();
  }

  try {
    return new URL(rawUrl, "https://example.com").searchParams;
  } catch {
    return new URLSearchParams();
  }
}

function classifyGa4Channel(params: {
  channelGroup: string;
  source: string;
  medium: string;
  campaign: string;
  landingPath: string;
}): AcquisitionChannel | null {
  const channelGroup = params.channelGroup.toLowerCase();
  const source = params.source.toLowerCase();
  const medium = params.medium.toLowerCase();
  const campaign = params.campaign.toLowerCase();
  const context = `${source} ${medium} ${campaign} ${params.landingPath}`;

  if (
    channelGroup.includes("paid search") ||
    ((source.includes("google") || campaign.includes("google")) &&
      /(cpc|ppc|paid|paidsearch|shopping|display|remarketing)/.test(`${medium} ${campaign}`))
  ) {
    return "google_ads";
  }

  const organicSearch = channelGroup.includes("organic search") || medium.includes("organic");
  if (organicSearch && source.includes("google") && !containsBrand(context)) {
    return "unbranded_seo";
  }

  return null;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function fetchGa4AttributionSignals(timeoutMs: number): Promise<Ga4AttributionSignals | null> {
  const propertyId = readEnv(["GA4_PROPERTY_ID"]);
  const clientEmail = readEnv(["GA4_CLIENT_EMAIL", "GOOGLE_CLIENT_EMAIL"]);
  const privateKeyRaw = readEnv(["GA4_PRIVATE_KEY", "GOOGLE_PRIVATE_KEY"]);

  if (!propertyId || !clientEmail || !privateKeyRaw) {
    return null;
  }

  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
  const client = new BetaAnalyticsDataClient({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey
    }
  });

  const { yearStart } = getBoundaries();
  const startDate = yearStart.toISOString().slice(0, 10);

  const [report] = await withTimeout(
    client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate: "today" }],
      dimensions: [
        { name: "landingPagePlusQueryString" },
        { name: "sessionDefaultChannelGroup" },
        { name: "sessionSource" },
        { name: "sessionMedium" },
        { name: "sessionCampaignName" }
      ],
      metrics: [{ name: "transactions" }],
      limit: 50_000
    }),
    Math.min(timeoutMs, 10_000),
    "GA4 attribution"
  );

  const totals = initChannelCounts();
  const byPath = new Map<string, ChannelCounts>();

  for (const row of report.rows ?? []) {
    const landingRaw = row.dimensionValues?.[0]?.value ?? "";
    const channelGroup = row.dimensionValues?.[1]?.value ?? "";
    const source = row.dimensionValues?.[2]?.value ?? "";
    const medium = row.dimensionValues?.[3]?.value ?? "";
    const campaign = row.dimensionValues?.[4]?.value ?? "";
    const transactions = toNumber(row.metricValues?.[0]?.value ?? 0);

    if (transactions <= 0) {
      continue;
    }

    const landingPath = normalizeLandingPath(landingRaw);
    const channel = classifyGa4Channel({
      channelGroup,
      source,
      medium,
      campaign,
      landingPath
    });

    if (!channel) {
      continue;
    }

    totals[channel] += transactions;

    if (!landingPath) {
      continue;
    }

    const current = byPath.get(landingPath) ?? initChannelCounts();
    current[channel] += transactions;
    byPath.set(landingPath, current);
  }

  if (totals.google_ads <= 0 && totals.unbranded_seo <= 0) {
    return null;
  }

  return {
    totals,
    byPath
  };
}

function detectAcquisition(
  order: ShopifyOrder,
  ga4Signals: Ga4AttributionSignals | null
): AcquisitionChannel | null {
  const landingPath = normalizeLandingPath(order.landingPageUrl);

  if (ga4Signals && landingPath) {
    const pathwayCounts = ga4Signals.byPath.get(landingPath);
    if (pathwayCounts) {
      const pathwayMatch = pickDominantChannel(pathwayCounts);
      if (pathwayMatch) {
        return pathwayMatch;
      }
    }
  }

  const landing = order.landingPageUrl.toLowerCase();
  const referring = order.referringSite.toLowerCase();
  const params = parseSearchParams(order.landingPageUrl);

  const utmSource = (params.get("utm_source") ?? "").toLowerCase();
  const utmMedium = (params.get("utm_medium") ?? "").toLowerCase();
  const utmCampaign = (params.get("utm_campaign") ?? "").toLowerCase();
  const utmTerm = (params.get("utm_term") ?? "").toLowerCase();

  const context = `${landing} ${referring} ${utmSource} ${utmMedium} ${utmCampaign} ${utmTerm}`;
  const hasGclid = context.includes("gclid=");
  const fromGoogle = utmSource.includes("google") || referring.includes("google.");
  const paidMedium = /(cpc|ppc|paid|paidsearch|shopping|display|remarketing)/.test(utmMedium + " " + utmCampaign);
  const organicGoogle = detectOrganicGoogle(utmSource, utmMedium, referring);

  const heuristicChannel: AcquisitionChannel | null =
    hasGclid || (fromGoogle && paidMedium)
      ? "google_ads"
      : organicGoogle && !containsBrand(context)
        ? "unbranded_seo"
        : null;

  if (!heuristicChannel) {
    return null;
  }

  if (!ga4Signals) {
    return heuristicChannel;
  }

  if (ga4Signals.totals[heuristicChannel] > 0) {
    return heuristicChannel;
  }

  const totalsFallback = pickDominantChannel(ga4Signals.totals);
  return totalsFallback ?? heuristicChannel;
}

function average(sum: number, count: number) {
  return count > 0 ? sum / count : 0;
}

function deriveMetrics(orders: ShopifyOrder[], ga4Signals: Ga4AttributionSignals | null): DerivedMetrics {
  const { monthStart } = getBoundaries();

  const mtdOrders = orders.filter((order) => {
    const date = new Date(order.createdAt);
    return !Number.isNaN(date.getTime()) && date >= monthStart;
  });

  let usRevenueMtd = 0;
  let ukRevenueMtd = 0;

  const mtdCustomerStats = new Map<string, { ltv: number; lifetimeOrders: number }>();

  for (const order of mtdOrders) {
    if (order.countryCode === "US") {
      usRevenueMtd += order.revenue;
    }

    if (order.countryCode === "GB" || order.countryCode === "UK") {
      ukRevenueMtd += order.revenue;
    }

    if (!order.customerId) {
      continue;
    }

    if (order.customerLifetimeValue === null || order.customerLifetimeOrders === null) {
      continue;
    }

    mtdCustomerStats.set(order.customerId, {
      ltv: order.customerLifetimeValue,
      lifetimeOrders: order.customerLifetimeOrders
    });
  }

  let customerLifetimeValueSum = 0;
  let customerLifetimeOrdersSum = 0;
  let customerCount = 0;

  for (const stats of mtdCustomerStats.values()) {
    customerLifetimeValueSum += stats.ltv;
    customerLifetimeOrdersSum += stats.lifetimeOrders;
    customerCount += 1;
  }

  type CohortAccumulator = {
    firstOrderRevenueSum: number;
    firstOrderCount: number;
    ltvSum: number;
    ltvCount: number;
  };

  const initAccumulator = (): CohortAccumulator => ({
    firstOrderRevenueSum: 0,
    firstOrderCount: 0,
    ltvSum: 0,
    ltvCount: 0
  });

  const allAcc: Record<AcquisitionChannel, CohortAccumulator> = {
    google_ads: initAccumulator(),
    unbranded_seo: initAccumulator()
  };

  const reliableAcc: Record<AcquisitionChannel, CohortAccumulator> = {
    google_ads: initAccumulator(),
    unbranded_seo: initAccumulator()
  };

  const byCustomer = new Map<string, ShopifyOrder[]>();
  for (const order of orders) {
    if (!order.customerId) {
      continue;
    }

    const bucket = byCustomer.get(order.customerId) ?? [];
    bucket.push(order);
    byCustomer.set(order.customerId, bucket);
  }

  for (const customerOrders of byCustomer.values()) {
    customerOrders.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const firstOrder = customerOrders[0];
    if (!firstOrder) {
      continue;
    }

    const channel = detectAcquisition(firstOrder, ga4Signals);
    if (!channel) {
      continue;
    }

    const all = allAcc[channel];
    all.firstOrderRevenueSum += firstOrder.revenue;
    all.firstOrderCount += 1;

    if (firstOrder.customerLifetimeValue !== null) {
      all.ltvSum += firstOrder.customerLifetimeValue;
      all.ltvCount += 1;
    }

    const seenOrderCount = customerOrders.length;
    const lifetimeOrders = firstOrder.customerLifetimeOrders;
    const hasCompleteHistory = lifetimeOrders === null || lifetimeOrders <= seenOrderCount;

    if (!hasCompleteHistory) {
      continue;
    }

    const reliable = reliableAcc[channel];
    reliable.firstOrderRevenueSum += firstOrder.revenue;
    reliable.firstOrderCount += 1;

    if (firstOrder.customerLifetimeValue !== null) {
      reliable.ltvSum += firstOrder.customerLifetimeValue;
      reliable.ltvCount += 1;
    }
  }

  const selectAcc = (channel: AcquisitionChannel) =>
    reliableAcc[channel].firstOrderCount > 0 ? reliableAcc[channel] : allAcc[channel];

  const googleAcc = selectAcc("google_ads");
  const seoAcc = selectAcc("unbranded_seo");

  return {
    customerLifetimeValue: average(customerLifetimeValueSum, customerCount),
    customerAverageLifetimeOrders: average(customerLifetimeOrdersSum, customerCount),
    googleAdsFirstOrderAov: average(googleAcc.firstOrderRevenueSum, googleAcc.firstOrderCount),
    googleAdsLtv: average(googleAcc.ltvSum, googleAcc.ltvCount),
    unbrandedSeoFirstOrderAov: average(seoAcc.firstOrderRevenueSum, seoAcc.firstOrderCount),
    unbrandedSeoLtv: average(seoAcc.ltvSum, seoAcc.ltvCount),
    usRevenueMtd,
    ukRevenueMtd
  };
}

function detectOrganicGoogle(utmSource: string, utmMedium: string, referring: string) {
  const organicGoogle =
    referring.includes("google.") ||
    (utmSource.includes("google") && (utmMedium.includes("organic") || utmMedium.includes("seo") || utmMedium === ""));

  return organicGoogle;
}

export interface ShopifyProvider {
  getDashboardData(): Promise<ShopifyData>;
}

class ShopifyProviderImpl implements ShopifyProvider {
  private dataCache: CacheEntry | null = null;
  private tokenCache: TokenCacheEntry | null = null;
  private inFlight: Promise<ShopifyData> | null = null;

  async getDashboardData(): Promise<ShopifyData> {
    const cookieToken = await readShopifyAccessTokenFromCookie();
    const envToken = readEnv([
      "SHOPIFY_ADMIN_ACCESS_TOKEN",
      "SHOPIFY_ACCESS_TOKEN",
      "SHOPIFY_ADMIN_API_ACCESS_TOKEN",
      "SHOPIFY_APP_ACCESS_TOKEN",
      "SHOPIFY_TOKEN",
      "SHOPIFY_PRIVATE_TOKEN"
    ]);
    const authFingerprint = getAuthFingerprint(cookieToken || envToken);

    const now = Date.now();
    if (
      this.dataCache &&
      this.dataCache.expiresAt > now &&
      this.dataCache.authFingerprint === authFingerprint
    ) {
      return this.dataCache.data;
    }

    if (this.inFlight) {
      return this.inFlight;
    }

    this.inFlight = this.loadFresh()
      .then((data) => {
        this.dataCache = {
          data,
          expiresAt: Date.now() + DATA_CACHE_TTL_MS,
          authFingerprint
        };
        return data;
      })
      .finally(() => {
        this.inFlight = null;
      });

    return this.inFlight;
  }

  private async getAccessToken(config: ShopifyApiConfig): Promise<string> {
    if (config.adminAccessToken) {
      return config.adminAccessToken;
    }

    const cookieToken = await readShopifyAccessTokenFromCookie();
    if (looksLikeShopifyAccessToken(cookieToken)) {
      return cookieToken;
    }

    // Common misconfiguration: access token saved in secret/key env.
    if (looksLikeShopifyAccessToken(config.clientSecret)) {
      return config.clientSecret;
    }

    if (looksLikeShopifyAccessToken(config.clientId)) {
      return config.clientId;
    }

    if (this.tokenCache && this.tokenCache.expiresAt > Date.now()) {
      return this.tokenCache.token;
    }

    if (!config.allowTokenExchange) {
      throw new Error(
        "Missing Shopify admin access token. Set SHOPIFY_ADMIN_ACCESS_TOKEN (or SHOPIFY_ADMIN_API_ACCESS_TOKEN)."
      );
    }

    const token = await exchangeToken(config);
    this.tokenCache = token;
    return token.token;
  }

  private async loadFresh(): Promise<ShopifyData> {
    const config = resolveConfig();

    if (config.shopifyApi) {
      try {
        const token = await this.getAccessToken(config.shopifyApi);
        const orders = await fetchOrders(config.shopifyApi, token);
        const periods = aggregatePeriods(orders);
        let ga4Signals: Ga4AttributionSignals | null = null;

        try {
          ga4Signals = await fetchGa4AttributionSignals(config.shopifyApi.timeoutMs);
        } catch (error) {
          console.warn("[Shopify] GA4 attribution lookup failed. Falling back to Shopify-only attribution.", {
            error: error instanceof Error ? error.message : String(error)
          });
        }

        const metrics = deriveMetrics(orders, ga4Signals);

        return buildData(periods, metrics, config.shopifyApi.currency);
      } catch (error) {
        console.error("[Shopify] Shopify Admin API path failed.", {
          shopDomain: config.shopifyApi.shopDomain,
          hasAdminAccessToken: Boolean(config.shopifyApi.adminAccessToken),
          allowTokenExchange: config.shopifyApi.allowTokenExchange,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    if (config.appEndpoint) {
      try {
        return await fetchFromAppEndpoint(config.appEndpoint);
      } catch (error) {
        console.error("[Shopify] App endpoint path failed.", {
          endpoint: config.appEndpoint.endpoint,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    console.warn("[Shopify] No working auth path. Returning fallback.", {
      hasAppEndpoint: Boolean(
        readEnv(["SHOPIFY_APP_METRICS_ENDPOINT", "SHOPIFY_METRICS_ENDPOINT", "SHOPIFY_APP_ENDPOINT", "SHOPIFY_ENDPOINT"])
      ),
      hasClientId: Boolean(
        readEnv(["SHOPIFY_APP_CLIENT_ID", "SHOPIFY_CLIENT_ID", "SHOPIFY_API_KEY", "SHOPIFY_KEY", "SHOPIFY_PUBLIC_API_KEY"])
      ),
      hasClientSecret: Boolean(
        readEnv([
          "SHOPIFY_APP_CLIENT_SECRET",
          "SHOPIFY_CLIENT_SECRET",
          "SHOPIFY_API_SECRET",
          "SHOPIFY_SECRET_KEY",
          "SHOPIFY_SECRET",
          "SHOPIFY_API_PASSWORD"
        ])
      ),
      hasShopDomain: Boolean(
        readEnv([
          "SHOPIFY_STORE_DOMAIN",
          "SHOPIFY_SHOP_DOMAIN",
          "SHOPIFY_SHOP",
          "SHOPIFY_DOMAIN",
          "SHOPIFY_MYSHOPIFY_DOMAIN",
          "SHOPIFY_STORE_ID"
        ])
      ),
      hasAdminAccessToken: Boolean(
        readEnv([
          "SHOPIFY_ADMIN_ACCESS_TOKEN",
          "SHOPIFY_ACCESS_TOKEN",
          "SHOPIFY_ADMIN_API_ACCESS_TOKEN",
          "SHOPIFY_APP_ACCESS_TOKEN",
          "SHOPIFY_TOKEN",
          "SHOPIFY_PRIVATE_TOKEN"
        ])
      )
    });

    return blankData();
  }
}

export class ShopifyService {
  constructor(private readonly provider: ShopifyProvider) {}

  async getDashboardData() {
    return this.provider.getDashboardData();
  }
}

export const shopifyService = new ShopifyService(new ShopifyProviderImpl());
