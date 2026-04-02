import "server-only";

import type { GoogleAdsData } from "@/types/integrations";

type Totals = {
  cost: number;
  clicks: number;
  impressions: number;
  conversions: number;
  revenue: number;
};

type PeriodTotals = {
  period: string;
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  revenue: number;
  roas: number;
};

type AdsConfig = {
  clientId: string;
  clientSecret: string;
  developerToken: string;
  refreshToken: string;
  customerId: string;
  loginCustomerId?: string;
};

type EnvHealth = {
  hasClientId: boolean;
  hasClientSecret: boolean;
  hasDeveloperToken: boolean;
  hasRefreshToken: boolean;
  hasCustomerId: boolean;
  hasLoginCustomerId: boolean;
  hasRequiredEnv: boolean;
};

type GoogleAdsRow = {
  metrics?: Record<string, unknown>;
  segments?: Record<string, unknown>;
  campaign?: Record<string, unknown>;
};

type DashboardPayload = {
  rows: PeriodTotals[];
  trend: Array<{ label: string; value: number }>;
  split: Array<{ label: string; value: number }>;
};

const PERIODS = [
  { range: "TODAY", label: "Today" },
  { range: "YESTERDAY", label: "Yesterday" },
  { range: "LAST_7_DAYS", label: "Last 7 days" },
  { range: "THIS_MONTH", label: "Month to date" }
] as const;

const GOOGLE_ADS_API_VERSION = "v23";

export class GoogleAdsService {
  private readEnv(name: string, required = true): string {
    const rawValue = process.env[name];
    const value = rawValue?.trim().replace(/^['"]|['"]$/g, "");
    if (!value && required) {
      throw new Error(`Missing ${name}`);
    }
    return value ?? "";
  }

  private normalizeCustomerId(value: string, keyName: string) {
    const digits = value.replace(/\D/g, "");
    if (!digits) {
      throw new Error(`Invalid ${keyName}: "${value}"`);
    }
    return digits;
  }

  private getConfig(): AdsConfig {
    const loginCustomerRaw = this.readEnv("GOOGLE_ADS_LOGIN_CUSTOMER_ID", false);

    return {
      clientId: this.readEnv("GOOGLE_ADS_CLIENT_ID"),
      clientSecret: this.readEnv("GOOGLE_ADS_CLIENT_SECRET"),
      developerToken: this.readEnv("GOOGLE_ADS_DEVELOPER_TOKEN"),
      refreshToken: this.readEnv("GOOGLE_ADS_REFRESH_TOKEN"),
      customerId: this.normalizeCustomerId(
        this.readEnv("GOOGLE_ADS_CUSTOMER_ID"),
        "GOOGLE_ADS_CUSTOMER_ID"
      ),
      loginCustomerId: loginCustomerRaw
        ? this.normalizeCustomerId(loginCustomerRaw, "GOOGLE_ADS_LOGIN_CUSTOMER_ID")
        : undefined
    };
  }

  private getEnvHealth(): EnvHealth {
    const hasClientId = Boolean(process.env.GOOGLE_ADS_CLIENT_ID?.trim());
    const hasClientSecret = Boolean(process.env.GOOGLE_ADS_CLIENT_SECRET?.trim());
    const hasDeveloperToken = Boolean(process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim());
    const hasRefreshToken = Boolean(process.env.GOOGLE_ADS_REFRESH_TOKEN?.trim());
    const hasCustomerId = Boolean(process.env.GOOGLE_ADS_CUSTOMER_ID?.trim());
    const hasLoginCustomerId = Boolean(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.trim());

    return {
      hasClientId,
      hasClientSecret,
      hasDeveloperToken,
      hasRefreshToken,
      hasCustomerId,
      hasLoginCustomerId,
      hasRequiredEnv:
        hasClientId && hasClientSecret && hasDeveloperToken && hasRefreshToken && hasCustomerId
    };
  }

  private async getOAuthAccessToken(config: AdsConfig): Promise<string> {
    const body = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token"
    });

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      body
    });

    const payload = await this.parseJsonSafe(response);

    if (!response.ok) {
      const errorMessage = this.getOAuthErrorMessage(payload);
      throw new Error(`OAuth refresh failed (${response.status}): ${errorMessage}`);
    }

    const accessToken = (payload as { access_token?: unknown })?.access_token;
    if (typeof accessToken !== "string" || !accessToken) {
      throw new Error("OAuth refresh succeeded but access token was missing.");
    }

    return accessToken;
  }

  private async parseJsonSafe(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return {};
    }
  }

  private getOAuthErrorMessage(payload: unknown) {
    if (typeof payload !== "object" || payload === null) {
      return "unknown_oauth_error";
    }

    const oauthError = payload as { error?: unknown; error_description?: unknown };
    const parts: string[] = [];

    if (typeof oauthError.error === "string") {
      parts.push(`error=${oauthError.error}`);
    }

    if (typeof oauthError.error_description === "string") {
      parts.push(`error_description=${oauthError.error_description}`);
    }

    return parts.length > 0 ? parts.join(" | ") : "unknown_oauth_error";
  }

  private async runSearchQuery(
    config: AdsConfig,
    accessToken: string,
    query: string,
    includeLoginCustomerId: boolean
  ): Promise<GoogleAdsRow[]> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${accessToken}`,
      "developer-token": config.developerToken,
      "content-type": "application/json"
    };

    if (includeLoginCustomerId && config.loginCustomerId) {
      headers["login-customer-id"] = config.loginCustomerId;
    }

    const response = await fetch(
      `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${config.customerId}/googleAds:searchStream`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ query })
      }
    );

    const payload = await this.parseJsonSafe(response);

    if (!response.ok) {
      throw new Error(
        `Google Ads search failed (${response.status}): ${this.getGoogleAdsApiErrorMessage(payload)}`
      );
    }

    if (!Array.isArray(payload)) {
      const singleChunk = payload as { results?: GoogleAdsRow[] };
      return singleChunk.results ?? [];
    }

    const rows: GoogleAdsRow[] = [];
    payload.forEach((chunk) => {
      const resultChunk = (chunk as { results?: GoogleAdsRow[] }).results;
      if (Array.isArray(resultChunk)) {
        rows.push(...resultChunk);
      }
    });

    return rows;
  }

  private getGoogleAdsApiErrorMessage(payload: unknown) {
    if (typeof payload !== "object" || payload === null) {
      return "unknown_google_ads_error";
    }

    const root = payload as {
      error?: {
        code?: unknown;
        message?: unknown;
        status?: unknown;
      };
    };

    const parts: string[] = [];
    if (root.error) {
      if (typeof root.error.code === "number" || typeof root.error.code === "string") {
        parts.push(`code=${root.error.code}`);
      }
      if (typeof root.error.status === "string") {
        parts.push(`status=${root.error.status}`);
      }
      if (typeof root.error.message === "string") {
        parts.push(`message=${root.error.message}`);
      }
    }

    return parts.length > 0 ? parts.join(" | ") : "unknown_google_ads_error";
  }

  private readMetric(metrics: Record<string, unknown> | undefined, keys: string[]) {
    if (!metrics) {
      return 0;
    }

    for (const key of keys) {
      const value = metrics[key];
      if (typeof value === "number") {
        return value;
      }
      if (typeof value === "string" && value.trim()) {
        const parsed = Number(value);
        if (!Number.isNaN(parsed)) {
          return parsed;
        }
      }
    }

    return 0;
  }

  private readString(value: unknown) {
    return typeof value === "string" ? value : "";
  }

  private parseIsoDateToUtcLabel(dateText: string) {
    const [yearText, monthText, dayText] = dateText.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);

    if (!year || !month || !day) {
      return dateText;
    }

    const date = new Date(Date.UTC(year, month - 1, day));
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      timeZone: "UTC"
    }).format(date);
  }

  private async getTrendData(
    config: AdsConfig,
    accessToken: string,
    includeLoginCustomerId: boolean
  ): Promise<Array<{ label: string; value: number }>> {
    const rows = await this.runSearchQuery(
      config,
      accessToken,
      `
      SELECT
        segments.date,
        metrics.cost_micros,
        metrics.conversions_value
      FROM customer
      WHERE segments.date DURING LAST_7_DAYS
      ORDER BY segments.date
      `,
      includeLoginCustomerId
    );

    const byDate = new Map<string, { cost: number; revenue: number }>();

    for (const row of rows) {
      const date = this.readString(row.segments?.date);
      if (!date) {
        continue;
      }

      const cost = this.readMetric(row.metrics, ["costMicros", "cost_micros"]);
      const revenue = this.readMetric(row.metrics, ["conversionsValue", "conversions_value"]);

      const existing = byDate.get(date) ?? { cost: 0, revenue: 0 };
      existing.cost += cost;
      existing.revenue += revenue;
      byDate.set(date, existing);
    }

    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, totals]) => {
        const spend = totals.cost / 1_000_000;
        const roas = spend > 0 ? totals.revenue / spend : 0;
        return {
          label: this.parseIsoDateToUtcLabel(date),
          value: Number(roas.toFixed(2))
        };
      });
  }

  private isBrandedCampaign(name: string) {
    const normalized = name.toLowerCase();

    const nonBrandedHints = ["non-brand", "non brand", "generic", "prospecting", "competitor"];
    if (nonBrandedHints.some((hint) => normalized.includes(hint))) {
      return false;
    }

    const brandedHints = ["brand", "branded", "tsl", "snus life", "thesnuslife"];
    return brandedHints.some((hint) => normalized.includes(hint));
  }

  private async getBrandedSplitData(
    config: AdsConfig,
    accessToken: string,
    includeLoginCustomerId: boolean
  ): Promise<Array<{ label: string; value: number }>> {
    const rows = await this.runSearchQuery(
      config,
      accessToken,
      `
      SELECT
        campaign.name,
        metrics.cost_micros
      FROM campaign
      WHERE segments.date DURING LAST_7_DAYS
      `,
      includeLoginCustomerId
    );

    let brandedCost = 0;
    let nonBrandedCost = 0;

    for (const row of rows) {
      const campaignName = this.readString(row.campaign?.name);
      const cost = this.readMetric(row.metrics, ["costMicros", "cost_micros"]);

      if (cost <= 0) {
        continue;
      }

      if (this.isBrandedCampaign(campaignName)) {
        brandedCost += cost;
      } else {
        nonBrandedCost += cost;
      }
    }

    const total = brandedCost + nonBrandedCost;
    if (total <= 0) {
      return [];
    }

    const brandedPercent = Math.round((brandedCost / total) * 100);
    const nonBrandedPercent = Math.max(0, 100 - brandedPercent);

    return [
      { label: "Branded", value: brandedPercent },
      { label: "Non-Branded", value: nonBrandedPercent }
    ];
  }

  private async getRange(
    config: AdsConfig,
    accessToken: string,
    dateRange: string,
    label: string,
    includeLoginCustomerId: boolean
  ): Promise<PeriodTotals> {
    const rows = await this.runSearchQuery(
      config,
      accessToken,
      `
      SELECT
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions,
        metrics.conversions,
        metrics.conversions_value
      FROM customer
      WHERE segments.date DURING ${dateRange}
      `,
      includeLoginCustomerId
    );

    const totals = rows.reduce<Totals>(
      (acc, row) => {
        const metrics = row.metrics;

        acc.cost += this.readMetric(metrics, ["costMicros", "cost_micros"]);
        acc.clicks += this.readMetric(metrics, ["clicks"]);
        acc.impressions += this.readMetric(metrics, ["impressions"]);
        acc.conversions += this.readMetric(metrics, ["conversions"]);
        acc.revenue += this.readMetric(metrics, ["conversionsValue", "conversions_value"]);

        return acc;
      },
      { cost: 0, clicks: 0, impressions: 0, conversions: 0, revenue: 0 }
    );

    const spend = totals.cost / 1_000_000;
    const roas = spend > 0 ? totals.revenue / spend : 0;

    return {
      period: label,
      spend,
      clicks: totals.clicks,
      impressions: totals.impressions,
      conversions: totals.conversions,
      revenue: totals.revenue,
      roas
    };
  }

  private formatCurrency(value: number) {
    return `£${value.toLocaleString("en-GB", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  private formatNumber(value: number) {
    return value.toLocaleString("en-GB", { maximumFractionDigits: 2 });
  }

  private buildDashboardData(
    rows: PeriodTotals[],
    trend: Array<{ label: string; value: number }>,
    split: Array<{ label: string; value: number }>
  ): GoogleAdsData {
    const monthToDate = rows.find((row) => row.period === "Month to date");

    return {
      kpiGroups: [
        {
          id: "google-ads-overview",
          label: "Google Ads Overview",
          metrics: [
            {
              id: "ads-spend",
              label: "Spend (Month to date)",
              value: this.formatCurrency(monthToDate?.spend ?? 0),
              change: undefined
            },
            {
              id: "ads-clicks",
              label: "Clicks (Month to date)",
              value: this.formatNumber(monthToDate?.clicks ?? 0),
              change: undefined
            },
            {
              id: "ads-impressions",
              label: "Impressions (Month to date)",
              value: this.formatNumber(monthToDate?.impressions ?? 0),
              change: undefined
            },
            {
              id: "ads-conversions",
              label: "Conversions (Month to date)",
              value: this.formatNumber(monthToDate?.conversions ?? 0),
              change: undefined
            },
            {
              id: "ads-roas",
              label: "ROAS (Month to date)",
              value: `${(monthToDate?.roas ?? 0).toFixed(2)}x`,
              change: undefined
            },
            {
              id: "ads-total-revenue",
              label: "Total Revenue (Month to date)",
              value: this.formatCurrency(monthToDate?.revenue ?? 0),
              change: undefined
            }
          ]
        }
      ],
      charts: {
        trend,
        split
      },
      tables: [
        {
          key: "ads-performance",
          title: "Google Ads Performance",
          rows: rows.map((row) => ({
            Period: row.period,
            Spend: this.formatCurrency(row.spend),
            Clicks: this.formatNumber(row.clicks),
            Impressions: this.formatNumber(row.impressions),
            Conversions: this.formatNumber(row.conversions),
            "Total Revenue": this.formatCurrency(row.revenue),
            ROAS: `${row.roas.toFixed(2)}x`
          }))
        }
      ]
    };
  }

  private async fetchDashboardRows(
    config: AdsConfig,
    includeLoginCustomerId: boolean
  ): Promise<DashboardPayload> {
    const accessToken = await this.getOAuthAccessToken(config);

    const [rows, trend, split] = await Promise.all([
      Promise.all(
        PERIODS.map((period) =>
          this.getRange(config, accessToken, period.range, period.label, includeLoginCustomerId)
        )
      ),
      this.getTrendData(config, accessToken, includeLoginCustomerId).catch((error) => {
        console.error("[Google Ads] Trend query failed.", {
          customerId: config.customerId,
          error: this.getErrorMessage(error)
        });
        return [];
      }),
      this.getBrandedSplitData(config, accessToken, includeLoginCustomerId).catch((error) => {
        console.error("[Google Ads] Branded split query failed.", {
          customerId: config.customerId,
          error: this.getErrorMessage(error)
        });
        return [];
      })
    ]);

    return { rows, trend, split };
  }

  private async listAccessibleCustomers(config: AdsConfig): Promise<string[]> {
    try {
      const accessToken = await this.getOAuthAccessToken(config);
      const response = await fetch(
        `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers:listAccessibleCustomers`,
        {
          method: "GET",
          headers: {
            authorization: `Bearer ${accessToken}`,
            "developer-token": config.developerToken
          }
        }
      );

      const payload = await this.parseJsonSafe(response);
      if (!response.ok) {
        return [];
      }

      const resourceNames =
        (payload as { resourceNames?: string[] }).resourceNames ??
        (payload as { resource_names?: string[] }).resource_names ??
        [];

      return resourceNames.map((name) => name.replace("customers/", ""));
    } catch {
      return [];
    }
  }

  private getErrorMessage(error: unknown) {
    if (!error) {
      return "Unknown Google Ads error";
    }

    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === "object" && error !== null) {
      try {
        return JSON.stringify(error);
      } catch {
        return "Unknown Google Ads error object";
      }
    }

    return String(error);
  }

  private isPermissionError(error: unknown) {
    const message = this.getErrorMessage(error).toLowerCase();
    return (
      message.includes("permission") ||
      message.includes("not authorized") ||
      message.includes("authorization") ||
      message.includes("login customer")
    );
  }

  private fallback(): GoogleAdsData {
    return {
      kpiGroups: [
        {
          id: "google-ads-overview",
          label: "Google Ads Overview",
          metrics: [
            {
              id: "ads-spend",
              label: "Spend",
              value: "-",
              change: undefined
            },
            {
              id: "ads-clicks",
              label: "Clicks",
              value: "-",
              change: undefined
            },
            {
              id: "ads-impressions",
              label: "Impressions",
              value: "-",
              change: undefined
            },
            {
              id: "ads-conversions",
              label: "Conversions",
              value: "-",
              change: undefined
            },
            {
              id: "ads-roas",
              label: "ROAS",
              value: "-",
              change: undefined
            },
            {
              id: "ads-total-revenue",
              label: "Total Revenue",
              value: "-",
              change: undefined
            }
          ]
        }
      ],
      charts: {
        trend: [],
        split: []
      },
      tables: [
        {
          key: "ads-performance",
          title: "Google Ads Performance",
          rows: [
            {
              Period: "Today",
              Spend: "-",
              Clicks: "-",
              Impressions: "-",
              Conversions: "-",
              "Total Revenue": "-",
              ROAS: "-"
            },
            {
              Period: "Yesterday",
              Spend: "-",
              Clicks: "-",
              Impressions: "-",
              Conversions: "-",
              "Total Revenue": "-",
              ROAS: "-"
            },
            {
              Period: "Last 7 days",
              Spend: "-",
              Clicks: "-",
              Impressions: "-",
              Conversions: "-",
              "Total Revenue": "-",
              ROAS: "-"
            },
            {
              Period: "Month to date",
              Spend: "-",
              Clicks: "-",
              Impressions: "-",
              Conversions: "-",
              "Total Revenue": "-",
              ROAS: "-"
            }
          ]
        }
      ]
    };
  }

  async getDashboardData(): Promise<GoogleAdsData> {
    const envHealth = this.getEnvHealth();
    let config: AdsConfig | undefined;

    try {
      if (!envHealth.hasRequiredEnv) {
        console.error("[Google Ads] Missing required environment variables.", envHealth);
        return this.fallback();
      }

      config = this.getConfig();
      const data = await this.fetchDashboardRows(config, true);
      return this.buildDashboardData(data.rows, data.trend, data.split);
    } catch (initialError) {
      if (config?.loginCustomerId && this.isPermissionError(initialError)) {
        try {
          const data = await this.fetchDashboardRows(config, false);
          console.warn(
            `[Google Ads] login_customer_id=${config.loginCustomerId} could not access customer ${config.customerId}. Retried without login_customer_id and succeeded.`
          );
          return this.buildDashboardData(data.rows, data.trend, data.split);
        } catch (retryError) {
          const accessibleCustomerIds = await this.listAccessibleCustomers(config);
          console.error("[Google Ads] Auth failed (with and without login_customer_id).", {
            customerId: config.customerId,
            loginCustomerId: config.loginCustomerId,
            accessibleCustomerIds,
            envHealth,
            initialError: this.getErrorMessage(initialError),
            retryError: this.getErrorMessage(retryError)
          });
          return this.fallback();
        }
      }

      const accessibleCustomerIds = config ? await this.listAccessibleCustomers(config) : [];
      console.error("[Google Ads] Query failed.", {
        customerId: config?.customerId ?? "<unset>",
        loginCustomerId: config?.loginCustomerId ?? "<unset>",
        accessibleCustomerIds,
        envHealth,
        error: this.getErrorMessage(initialError)
      });

      return this.fallback();
    }
  }
}

export const googleAdsService = new GoogleAdsService();
