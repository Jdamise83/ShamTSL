import "server-only";

import { createSign } from "crypto";

import type { SeoData } from "@/types/integrations";

type SearchConsoleRow = {
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
  keys?: string[];
};

type SearchConsoleConfig = {
  siteUrl: string;
  clientEmail: string;
  privateKey: string;
};

type SearchConsoleEnvHealth = {
  hasSiteUrl: boolean;
  hasClientEmail: boolean;
  hasPrivateKey: boolean;
  hasRequiredEnv: boolean;
};

type SearchConsolePeriod = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
};

type SearchConsoleTotals = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

type SearchConsoleAggregate = {
  clicks: number;
  impressions: number;
  positionNumerator: number;
};

type SearchConsoleQueryBody = {
  startDate: string;
  endDate: string;
  dimensions?: string[];
  rowLimit?: number;
  startRow?: number;
  dataState?: "all" | "final";
  type?: "web" | "discover" | "googleNews" | "news";
};

const SEARCH_CONSOLE_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const SEARCH_CONSOLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const SEARCH_CONSOLE_QUERY_BASE = "https://www.googleapis.com/webmasters/v3/sites";

export interface SeoProvider {
  getDashboardData(): Promise<SeoData>;
}

class RealSeoProvider implements SeoProvider {
  private readEnv(name: string): string {
    return process.env[name]?.trim().replace(/^['"]|['"]$/g, "") ?? "";
  }

  private readFirstEnv(names: string[], label: string): string {
    for (const name of names) {
      const value = this.readEnv(name);
      if (value) {
        return value;
      }
    }
    throw new Error(`Missing ${label}`);
  }

  private getConfig(): SearchConsoleConfig {
    const siteUrl = this.readFirstEnv(
      ["SEARCH_CONSOLE_SITE_URL", "GSC_SITE_URL", "GOOGLE_SEARCH_CONSOLE_SITE_URL"],
      "SEARCH_CONSOLE_SITE_URL"
    );

    const clientEmail = this.readFirstEnv(
      ["SEARCH_CONSOLE_CLIENT_EMAIL", "GOOGLE_CLIENT_EMAIL", "GA4_CLIENT_EMAIL"],
      "SEARCH_CONSOLE_CLIENT_EMAIL"
    );

    const privateKey = this.readFirstEnv(
      ["SEARCH_CONSOLE_PRIVATE_KEY", "GOOGLE_PRIVATE_KEY", "GA4_PRIVATE_KEY"],
      "SEARCH_CONSOLE_PRIVATE_KEY"
    ).replace(/\\n/g, "\n");

    return { siteUrl, clientEmail, privateKey };
  }

  private getEnvHealth(): SearchConsoleEnvHealth {
    const hasSiteUrl = Boolean(this.readEnv("SEARCH_CONSOLE_SITE_URL"));
    const hasClientEmail = Boolean(
      this.readEnv("SEARCH_CONSOLE_CLIENT_EMAIL") ||
        this.readEnv("GOOGLE_CLIENT_EMAIL") ||
        this.readEnv("GA4_CLIENT_EMAIL")
    );
    const hasPrivateKey = Boolean(
      this.readEnv("SEARCH_CONSOLE_PRIVATE_KEY") ||
        this.readEnv("GOOGLE_PRIVATE_KEY") ||
        this.readEnv("GA4_PRIVATE_KEY")
    );

    return {
      hasSiteUrl,
      hasClientEmail,
      hasPrivateKey,
      hasRequiredEnv: hasSiteUrl && hasClientEmail && hasPrivateKey
    };
  }

  private getBrandTerms() {
    const customTerms = this.readEnv("SEARCH_CONSOLE_BRAND_TERMS");
    if (!customTerms) {
      return ["snus life", "thesnuslife", "the snus life", "tsl"];
    }

    return customTerms
      .split(",")
      .map((term) => term.trim().toLowerCase())
      .filter(Boolean);
  }

  private isBrandedQuery(query: string) {
    const normalized = query.toLowerCase();
    return this.getBrandTerms().some((term) => normalized.includes(term));
  }

  private base64UrlEncode(value: string | Buffer) {
    return Buffer.from(value)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }

  private toIsoDate(date: Date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private utcDayStart(date = new Date()) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  private daysAgo(days: number) {
    const date = this.utcDayStart();
    date.setUTCDate(date.getUTCDate() - days);
    return date;
  }

  private startOfCurrentMonth() {
    const date = this.utcDayStart();
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }

  private startOfCurrentYear() {
    const date = this.utcDayStart();
    return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  }

  private getReportingPeriods(): SearchConsolePeriod[] {
    const yesterday = this.daysAgo(1);
    const endDate = this.toIsoDate(yesterday);

    const monthStart = this.startOfCurrentMonth();
    const yearStart = this.startOfCurrentYear();

    return [
      {
        id: "seo-last7",
        label: "Last 7 Days",
        startDate: this.toIsoDate(this.daysAgo(7)),
        endDate
      },
      {
        id: "seo-mtd",
        label: "Month To Date",
        startDate: this.toIsoDate(monthStart <= yesterday ? monthStart : yesterday),
        endDate
      },
      {
        id: "seo-ytd",
        label: "Year To Date",
        startDate: this.toIsoDate(yearStart <= yesterday ? yearStart : yesterday),
        endDate
      }
    ];
  }

  private async getAccessToken(config: SearchConsoleConfig): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const header = {
      alg: "RS256",
      typ: "JWT"
    };

    const payload = {
      iss: config.clientEmail,
      scope: SEARCH_CONSOLE_SCOPE,
      aud: SEARCH_CONSOLE_TOKEN_URL,
      iat: now,
      exp: now + 3600
    };

    const unsigned = `${this.base64UrlEncode(JSON.stringify(header))}.${this.base64UrlEncode(
      JSON.stringify(payload)
    )}`;
    const signer = createSign("RSA-SHA256");
    signer.update(unsigned);
    signer.end();

    const signature = signer.sign(config.privateKey);
    const assertion = `${unsigned}.${this.base64UrlEncode(signature)}`;

    const body = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    });

    const response = await fetch(SEARCH_CONSOLE_TOKEN_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      body
    });

    const payloadJson = await this.parseJsonSafe(response);
    if (!response.ok) {
      throw new Error(
        `Search Console token error (${response.status}): ${this.getApiErrorMessage(payloadJson)}`
      );
    }

    const accessToken = (payloadJson as { access_token?: unknown }).access_token;
    if (typeof accessToken !== "string" || !accessToken) {
      throw new Error("Search Console token response did not include access_token");
    }

    return accessToken;
  }

  private parseJsonSafe(response: Response): Promise<unknown> {
    return response
      .json()
      .then((json) => json)
      .catch(() => ({}));
  }

  private getApiErrorMessage(payload: unknown) {
    if (typeof payload !== "object" || payload === null) {
      return "unknown error payload";
    }

    const root = payload as Record<string, unknown>;

    if (typeof root.error_description === "string") {
      return root.error_description;
    }

    if (typeof root.error === "string") {
      return root.error;
    }

    const apiError =
      typeof root.error === "object" && root.error !== null
        ? (root.error as { code?: unknown; message?: unknown; status?: unknown })
        : undefined;
    if (apiError) {
      const parts: string[] = [];
      if (typeof apiError.code === "number" || typeof apiError.code === "string") {
        parts.push(`code=${apiError.code}`);
      }
      if (typeof apiError.status === "string") {
        parts.push(`status=${apiError.status}`);
      }
      if (typeof apiError.message === "string") {
        parts.push(`message=${apiError.message}`);
      }
      if (parts.length > 0) {
        return parts.join(" | ");
      }
    }

    return "unknown error payload";
  }

  private getSiteUrlCandidates(siteUrl: string) {
    const trimmed = siteUrl.trim();
    if (trimmed.startsWith("sc-domain:")) {
      return [trimmed];
    }

    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const candidates = new Set<string>();
    candidates.add(withProtocol);

    if (withProtocol.endsWith("/")) {
      candidates.add(withProtocol.slice(0, -1));
    } else {
      candidates.add(`${withProtocol}/`);
    }

    try {
      const url = new URL(withProtocol);
      candidates.add(`sc-domain:${url.hostname}`);
      if (url.hostname.startsWith("www.")) {
        candidates.add(`sc-domain:${url.hostname.slice(4)}`);
      }
    } catch {
      // If parsing fails, we still keep the original URL candidates.
    }

    return [...candidates];
  }

  private async listAccessibleSites(accessToken: string): Promise<string[]> {
    try {
      const response = await fetch(`${SEARCH_CONSOLE_QUERY_BASE}`, {
        method: "GET",
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      });

      const payload = await this.parseJsonSafe(response);
      if (!response.ok) {
        return [];
      }

      const entries = (payload as { siteEntry?: Array<{ siteUrl?: string }> }).siteEntry ?? [];
      return entries
        .map((entry) => entry.siteUrl ?? "")
        .filter((site): site is string => Boolean(site));
    } catch {
      return [];
    }
  }

  private async runSearchQuery(
    config: SearchConsoleConfig,
    accessToken: string,
    body: SearchConsoleQueryBody
  ): Promise<SearchConsoleRow[]> {
    const siteUrlCandidates = this.getSiteUrlCandidates(config.siteUrl);
    let lastError: unknown;

    for (const siteUrl of siteUrlCandidates) {
      const endpoint = `${SEARCH_CONSOLE_QUERY_BASE}/${encodeURIComponent(
        siteUrl
      )}/searchAnalytics/query`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          ...body,
          dataState: body.dataState ?? "final",
          type: body.type ?? "web"
        })
      });

      const payload = await this.parseJsonSafe(response);
      if (response.ok) {
        return ((payload as { rows?: SearchConsoleRow[] }).rows ?? []).map((row) => ({
          clicks: Number(row.clicks ?? 0),
          impressions: Number(row.impressions ?? 0),
          ctr: Number(row.ctr ?? 0),
          position: Number(row.position ?? 0),
          keys: Array.isArray(row.keys) ? row.keys : []
        }));
      }

      lastError = new Error(
        `Search Console query error (${response.status}) for site "${siteUrl}": ${this.getApiErrorMessage(
          payload
        )}`
      );
    }

    throw lastError instanceof Error ? lastError : new Error("Search Console query failed");
  }

  private formatInteger(value: number) {
    return Math.round(value).toLocaleString("en-GB");
  }

  private formatPercent(value: number) {
    return `${(value * 100).toFixed(2)}%`;
  }

  private formatPosition(value: number) {
    return value > 0 ? value.toFixed(1) : "-";
  }

  private getTotalsFromRows(rows: SearchConsoleRow[]): SearchConsoleTotals {
    if (!rows.length) {
      return { clicks: 0, impressions: 0, ctr: 0, position: 0 };
    }

    const totals = rows.reduce<SearchConsoleAggregate>(
      (acc, row) => {
        acc.clicks += Number(row.clicks ?? 0);
        acc.impressions += Number(row.impressions ?? 0);
        acc.positionNumerator += Number(row.position ?? 0) * Number(row.impressions ?? 0);
        return acc;
      },
      { clicks: 0, impressions: 0, positionNumerator: 0 }
    );

    const ctr = totals.impressions > 0 ? totals.clicks / totals.impressions : 0;
    const position =
      totals.impressions > 0 ? totals.positionNumerator / totals.impressions : 0;

    return {
      clicks: totals.clicks,
      impressions: totals.impressions,
      ctr,
      position
    };
  }

  private formatTrendLabel(isoDate: string) {
    const [year, month, day] = isoDate.split("-").map(Number);
    if (!year || !month || !day) {
      return isoDate;
    }

    const date = new Date(Date.UTC(year, month - 1, day));
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      timeZone: "UTC"
    }).format(date);
  }

  private async getKpiGroups(config: SearchConsoleConfig, accessToken: string) {
    const periods = this.getReportingPeriods();

    const periodRows = await Promise.all(
      periods.map((period) =>
        this.runSearchQuery(config, accessToken, {
          startDate: period.startDate,
          endDate: period.endDate,
          rowLimit: 25000
        })
      )
    );

    return periods.map((period, index) => {
      const totals = this.getTotalsFromRows(periodRows[index]);
      return {
        id: period.id,
        label: period.label,
        metrics: [
          {
            id: `${period.id}-clicks`,
            label: "Organic Clicks",
            value: this.formatInteger(totals.clicks),
            change: undefined
          },
          {
            id: `${period.id}-impressions`,
            label: "Impressions",
            value: this.formatInteger(totals.impressions),
            change: undefined
          },
          {
            id: `${period.id}-ctr`,
            label: "Avg CTR",
            value: this.formatPercent(totals.ctr),
            change: undefined
          },
          {
            id: `${period.id}-position`,
            label: "Avg Position",
            value: this.formatPosition(totals.position),
            change: undefined
          }
        ]
      };
    });
  }

  private async getTrendData(config: SearchConsoleConfig, accessToken: string) {
    const rows = await this.runSearchQuery(config, accessToken, {
      startDate: this.toIsoDate(this.daysAgo(14)),
      endDate: this.toIsoDate(this.daysAgo(1)),
      dimensions: ["date"],
      rowLimit: 100
    });

    return rows
      .filter((row) => row.keys?.[0])
      .map((row) => ({
        label: this.formatTrendLabel(row.keys?.[0] ?? ""),
        value: Number(row.clicks ?? 0)
      }));
  }

  private async getSplitData(config: SearchConsoleConfig, accessToken: string) {
    const rows = await this.runSearchQuery(config, accessToken, {
      startDate: this.toIsoDate(this.daysAgo(30)),
      endDate: this.toIsoDate(this.daysAgo(1)),
      dimensions: ["query"],
      rowLimit: 250
    });

    let brandedClicks = 0;
    let unbrandedClicks = 0;

    rows.forEach((row) => {
      const query = (row.keys?.[0] ?? "").trim();
      const clicks = Number(row.clicks ?? 0);
      if (!query || clicks <= 0) {
        return;
      }

      if (this.isBrandedQuery(query)) {
        brandedClicks += clicks;
      } else {
        unbrandedClicks += clicks;
      }
    });

    const total = brandedClicks + unbrandedClicks;
    if (total <= 0) {
      return [];
    }

    const branded = Math.round((brandedClicks / total) * 100);
    const unbranded = Math.max(0, 100 - branded);

    return [
      { label: "Branded", value: branded },
      { label: "Unbranded", value: unbranded }
    ];
  }

  private async getTopQueryRows(config: SearchConsoleConfig, accessToken: string) {
    const rows = await this.runSearchQuery(config, accessToken, {
      startDate: this.toIsoDate(this.daysAgo(28)),
      endDate: this.toIsoDate(this.daysAgo(1)),
      dimensions: ["query"],
      rowLimit: 10
    });

    return rows
      .filter((row) => row.keys?.[0])
      .map((row) => ({
        Query: row.keys?.[0] ?? "-",
        Clicks: this.formatInteger(Number(row.clicks ?? 0)),
        Impressions: this.formatInteger(Number(row.impressions ?? 0)),
        CTR: this.formatPercent(Number(row.ctr ?? 0)),
        Position: this.formatPosition(Number(row.position ?? 0))
      }));
  }

  private async getTopPageRows(config: SearchConsoleConfig, accessToken: string) {
    const rows = await this.runSearchQuery(config, accessToken, {
      startDate: this.toIsoDate(this.daysAgo(28)),
      endDate: this.toIsoDate(this.daysAgo(1)),
      dimensions: ["page"],
      rowLimit: 10
    });

    return rows
      .filter((row) => row.keys?.[0])
      .map((row) => ({
        Page: row.keys?.[0] ?? "-",
        Clicks: this.formatInteger(Number(row.clicks ?? 0)),
        Impressions: this.formatInteger(Number(row.impressions ?? 0)),
        CTR: this.formatPercent(Number(row.ctr ?? 0)),
        Position: this.formatPosition(Number(row.position ?? 0))
      }));
  }

  private fallback(): SeoData {
    return {
      kpiGroups: [
        {
          id: "seo-overview",
          label: "Search Console Overview",
          metrics: [
            { id: "seo-clicks", label: "Organic Clicks", value: "-", change: undefined },
            { id: "seo-impressions", label: "Impressions", value: "-", change: undefined },
            { id: "seo-ctr", label: "Avg CTR", value: "-", change: undefined },
            { id: "seo-position", label: "Avg Position", value: "-", change: undefined }
          ]
        }
      ],
      charts: {
        trend: [],
        split: []
      },
      tables: [
        {
          key: "seo-top-queries",
          title: "Top Queries (Last 28 Days)",
          rows: []
        },
        {
          key: "seo-top-pages",
          title: "Top Landing Pages (Last 28 Days)",
          rows: []
        }
      ]
    };
  }

  async getDashboardData(): Promise<SeoData> {
    const envHealth = this.getEnvHealth();

    try {
      if (!envHealth.hasRequiredEnv) {
        console.error("[SEO] Missing Search Console environment variables.", envHealth);
        return this.fallback();
      }

      const config = this.getConfig();
      const accessToken = await this.getAccessToken(config);

      const [kpiGroups, trend, split, topQueries, topPages] = await Promise.all([
        this.getKpiGroups(config, accessToken),
        this.getTrendData(config, accessToken),
        this.getSplitData(config, accessToken),
        this.getTopQueryRows(config, accessToken),
        this.getTopPageRows(config, accessToken)
      ]);

      return {
        kpiGroups,
        charts: {
          trend,
          split
        },
        tables: [
          {
            key: "seo-top-queries",
            title: "Top Queries (Last 28 Days)",
            rows: topQueries
          },
          {
            key: "seo-top-pages",
            title: "Top Landing Pages (Last 28 Days)",
            rows: topPages
          }
        ]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      let accessibleSites: string[] = [];
      try {
        const config = this.getConfig();
        const accessToken = await this.getAccessToken(config);
        accessibleSites = await this.listAccessibleSites(accessToken);
      } catch {
        accessibleSites = [];
      }

      console.error("[SEO] Search Console connection failed:", {
        error: errorMessage,
        envHealth,
        configuredSiteUrl: this.readEnv("SEARCH_CONSOLE_SITE_URL"),
        accessibleSites
      });
      return this.fallback();
    }
  }
}

export class SeoService {
  constructor(private readonly provider: SeoProvider) {}

  async getDashboardData() {
    return this.provider.getDashboardData();
  }
}

export const seoService = new SeoService(new RealSeoProvider());
