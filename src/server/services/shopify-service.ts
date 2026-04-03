import "server-only";

import type { LinePoint } from "@/types/dashboard";
import type { ShopifyData } from "@/types/integrations";

type PeriodKey = "day" | "last7" | "mtd" | "ytd";

interface PeriodSummary {
  key: PeriodKey;
  label: string;
  revenue: number;
  orders: number;
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
}

interface TokenCacheEntry {
  token: string;
  expiresAt: number;
}

interface ShopifyOrder {
  createdAt: string;
  revenue: number;
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

const PERIODS: Array<{ key: PeriodKey; label: string }> = [
  { key: "day", label: "Day" },
  { key: "last7", label: "Last 7 days" },
  { key: "mtd", label: "Month to date" },
  { key: "ytd", label: "YTD" }
];

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

function getBoundaries(now = new Date()) {
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const last7Start = new Date(dayStart);
  last7Start.setUTCDate(last7Start.getUTCDate() - 6);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const fetchStart = new Date(Math.min(last7Start.getTime(), monthStart.getTime(), yearStart.getTime()));

  return { now, dayStart, last7Start, monthStart, yearStart, fetchStart };
}

function blankData(): ShopifyData {
  return {
    kpiGroups: [
      {
        id: "shopify_orders_today_group",
        label: "Shopify Health Check",
        metrics: [{ id: "shopify_orders_today", label: "Orders today", value: "-" }]
      }
    ],
    charts: { trend: [], split: [] },
    tables: [
      {
        key: "shopify_financials",
        title: "Financial Performance",
        rows: PERIODS.map((period) => ({
          period: period.label,
          orders: "-",
          revenue: "-",
          aov: "-"
        }))
      }
    ]
  };
}

function buildData(periods: PeriodSummary[], currency: string): ShopifyData {
  const day = periods.find((period) => period.key === "day");

  const trend: LinePoint[] = periods.map((period) => ({
    label: period.key === "last7" ? "Last 7D" : period.key.toUpperCase(),
    value: period.revenue
  }));

  return {
    kpiGroups: [
      {
        id: "shopify_orders_today_group",
        label: "Shopify Health Check",
        metrics: [
          {
            id: "shopify_orders_today",
            label: "Orders today",
            value: formatNumber(day?.orders ?? 0)
          }
        ]
      }
    ],
    charts: {
      trend,
      split: []
    },
    tables: [
      {
        key: "shopify_financials",
        title: "Financial Performance",
        rows: periods.map((period) => {
          const aov = period.orders > 0 ? period.revenue / period.orders : 0;
          return {
            period: period.label,
            orders: formatNumber(period.orders),
            revenue: formatCurrency(period.revenue, currency),
            aov: formatCurrency(aov, currency)
          };
        })
      }
    ]
  };
}

function resolveConfig(): RuntimeConfig {
  const clientId = readEnv(["SHOPIFY_APP_CLIENT_ID", "SHOPIFY_CLIENT_ID", "SHOPIFY_API_KEY"]);
  const clientSecret = readEnv([
    "SHOPIFY_APP_CLIENT_SECRET",
    "SHOPIFY_CLIENT_SECRET",
    "SHOPIFY_API_SECRET",
    "SHOPIFY_SECRET_KEY"
  ]);
  const appEndpoint = readEnv(["SHOPIFY_APP_METRICS_ENDPOINT", "SHOPIFY_METRICS_ENDPOINT"]);

  const shopDomainRaw = readEnv(["SHOPIFY_STORE_DOMAIN", "SHOPIFY_SHOP_DOMAIN", "SHOPIFY_SHOP"]);
  const shopDomain = normalizeShopDomain(shopDomainRaw);
  const adminAccessToken = readEnv(["SHOPIFY_ADMIN_ACCESS_TOKEN", "SHOPIFY_ACCESS_TOKEN"]);
  const apiVersion = readEnv(["SHOPIFY_API_VERSION"]) || DEFAULT_API_VERSION;
  const currency = (readEnv(["SHOPIFY_CURRENCY"]) || "GBP").toUpperCase();
  const timeoutRaw = readEnv(["SHOPIFY_APP_TIMEOUT_MS", "SHOPIFY_TIMEOUT_MS"]);
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

      const rawKey = String(
        row.period ?? row.key ?? row.label ?? row.id ?? ""
      )
        .toLowerCase()
        .replace(/\s+/g, "_");

      const period =
        rawKey === "day" || rawKey === "today"
          ? "day"
          : rawKey === "last7" || rawKey === "last_7_days" || rawKey === "week" || rawKey === "wtd"
            ? "last7"
            : rawKey === "mtd" || rawKey === "month" || rawKey === "month_to_date"
              ? "mtd"
              : rawKey === "ytd" || rawKey === "year" || rawKey === "year_to_date" || rawKey === "this_year"
                ? "ytd"
              : null;

      if (!period) {
        continue;
      }

      const existing = periods.find((item) => item.key === period);
      if (!existing) {
        continue;
      }

      existing.revenue = toNumber(row.revenue ?? row.totalRevenue ?? row.sales ?? row.amount ?? 0);
      existing.orders = toNumber(row.orders ?? row.orderCount ?? row.count ?? 0);
    }
  }

  const ordersToday = toNumber(
    getByPath(payload, "ordersToday") ??
      getByPath(payload, "todayOrders") ??
      getByPath(payload, "summary.ordersToday") ??
      getByPath(payload, "data.ordersToday")
  );

  if (ordersToday > 0) {
    const day = periods.find((period) => period.key === "day");
    if (day) {
      day.orders = ordersToday;
    }
  }

  return buildData(periods, currency);
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

async function fetchOrders(config: ShopifyApiConfig, accessToken: string): Promise<ShopifyOrder[]> {
  const endpoint = `https://${config.shopDomain}/admin/api/${config.apiVersion}/graphql.json`;
  const { fetchStart } = getBoundaries();
  const queryFilter = `created_at:>=${fetchStart.toISOString()}`;

  const query = `
    query DashboardOrders($first: Int!, $after: String, $query: String!) {
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
    if (!response.ok) {
      const message = payload.errors?.[0]?.message ?? "Unknown GraphQL error";
      throw new Error(`GraphQL ${response.status}: ${message}`);
    }
    if (payload.errors?.length) {
      throw new Error(payload.errors[0]?.message ?? "GraphQL query failed.");
    }

    const edges = payload.data?.orders?.edges ?? [];
    for (const edge of edges) {
      const createdAt = edge.node?.createdAt;
      if (!createdAt) {
        continue;
      }

      const amount =
        edge.node?.currentTotalPriceSet?.shopMoney?.amount ?? edge.node?.totalPriceSet?.shopMoney?.amount ?? "0";

      orders.push({
        createdAt,
        revenue: toNumber(amount)
      });
    }

    hasNextPage = Boolean(payload.data?.orders?.pageInfo?.hasNextPage);
    cursor = payload.data?.orders?.pageInfo?.endCursor ?? null;
  }

  return orders;
}

function aggregate(orders: ShopifyOrder[]): PeriodSummary[] {
  const { now, dayStart, last7Start, monthStart, yearStart } = getBoundaries();

  const summary = new Map<PeriodKey, PeriodSummary>(
    PERIODS.map((period) => [
      period.key,
      { key: period.key, label: period.label, orders: 0, revenue: 0 }
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
        day.orders += 1;
        day.revenue += order.revenue;
      }
    }

    if (createdAt >= last7Start) {
      const last7 = summary.get("last7");
      if (last7) {
        last7.orders += 1;
        last7.revenue += order.revenue;
      }
    }

    if (createdAt >= monthStart) {
      const mtd = summary.get("mtd");
      if (mtd) {
        mtd.orders += 1;
        mtd.revenue += order.revenue;
      }
    }

    if (createdAt >= yearStart) {
      const ytd = summary.get("ytd");
      if (ytd) {
        ytd.orders += 1;
        ytd.revenue += order.revenue;
      }
    }
  }

  return PERIODS.map((period) => summary.get(period.key)).filter((item): item is PeriodSummary => Boolean(item));
}

export interface ShopifyProvider {
  getDashboardData(): Promise<ShopifyData>;
}

class ShopifyProviderImpl implements ShopifyProvider {
  private dataCache: CacheEntry | null = null;
  private tokenCache: TokenCacheEntry | null = null;
  private inFlight: Promise<ShopifyData> | null = null;

  async getDashboardData(): Promise<ShopifyData> {
    const now = Date.now();
    if (this.dataCache && this.dataCache.expiresAt > now) {
      return this.dataCache.data;
    }

    if (this.inFlight) {
      return this.inFlight;
    }

    this.inFlight = this.loadFresh()
      .then((data) => {
        this.dataCache = {
          data,
          expiresAt: Date.now() + DATA_CACHE_TTL_MS
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

    if (this.tokenCache && this.tokenCache.expiresAt > Date.now()) {
      return this.tokenCache.token;
    }

    const token = await exchangeToken(config);
    this.tokenCache = token;
    return token.token;
  }

  private async loadFresh(): Promise<ShopifyData> {
    const config = resolveConfig();

    if (config.appEndpoint) {
      try {
        return await fetchFromAppEndpoint(config.appEndpoint);
      } catch (error) {
        console.error("[Shopify] App endpoint path failed. Falling back to Shopify Admin API.", {
          endpoint: config.appEndpoint.endpoint,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    if (config.shopifyApi) {
      try {
        const token = await this.getAccessToken(config.shopifyApi);
        const orders = await fetchOrders(config.shopifyApi, token);
        const periods = aggregate(orders);
        return buildData(periods, config.shopifyApi.currency);
      } catch (error) {
        console.error("[Shopify] Shopify Admin API path failed.", {
          shopDomain: config.shopifyApi.shopDomain,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    console.warn("[Shopify] No working auth path. Returning fallback.", {
      hasAppEndpoint: Boolean(readEnv(["SHOPIFY_APP_METRICS_ENDPOINT", "SHOPIFY_METRICS_ENDPOINT"])),
      hasClientId: Boolean(readEnv(["SHOPIFY_APP_CLIENT_ID", "SHOPIFY_CLIENT_ID", "SHOPIFY_API_KEY"])),
      hasClientSecret: Boolean(
        readEnv(["SHOPIFY_APP_CLIENT_SECRET", "SHOPIFY_CLIENT_SECRET", "SHOPIFY_API_SECRET", "SHOPIFY_SECRET_KEY"])
      ),
      hasShopDomain: Boolean(readEnv(["SHOPIFY_STORE_DOMAIN", "SHOPIFY_SHOP_DOMAIN", "SHOPIFY_SHOP"]))
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
