import "server-only";
import { GoogleAdsApi } from "google-ads-api";

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

const PERIODS = [
  { range: "TODAY", label: "Today" },
  { range: "YESTERDAY", label: "Yesterday" },
  { range: "LAST_7_DAYS", label: "Last 7 days" },
  { range: "THIS_MONTH", label: "Month to date" }
] as const;

export class GoogleAdsService {
  private readEnv(name: string, required = true): string {
    const value = process.env[name]?.trim();
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

  private getClient(config: AdsConfig) {
    return new GoogleAdsApi({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      developer_token: config.developerToken
    });
  }

  private getCustomer(config: AdsConfig, includeLoginCustomerId: boolean) {
    const customerOptions: {
      customer_id: string;
      refresh_token: string;
      login_customer_id?: string;
    } = {
      customer_id: config.customerId,
      refresh_token: config.refreshToken
    };

    if (includeLoginCustomerId && config.loginCustomerId) {
      customerOptions.login_customer_id = config.loginCustomerId;
    }

    const client = this.getClient(config);

    return client.Customer(customerOptions);
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

  private getErrorMessage(error: unknown) {
    if (!error) {
      return "Unknown Google Ads error";
    }

    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === "object" && error !== null) {
      const maybeMessage = (error as { message?: unknown }).message;
      if (typeof maybeMessage === "string") {
        return maybeMessage;
      }
    }

    return String(error);
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

  private buildDashboardData(rows: PeriodTotals[]): GoogleAdsData {
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
        trend: [],
        split: []
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

  private async getRange(
    customer: ReturnType<GoogleAdsApi["Customer"]>,
    dateRange: string,
    label: string
  ): Promise<PeriodTotals> {
    const res = await customer.query(`
      SELECT
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions,
        metrics.conversions,
        metrics.conversions_value
      FROM customer
      WHERE segments.date DURING ${dateRange}
    `);

    const totals = res.reduce<Totals>(
      (acc, row) => {
        const metrics = row.metrics;

        acc.cost += Number(metrics?.cost_micros ?? 0);
        acc.clicks += Number(metrics?.clicks ?? 0);
        acc.impressions += Number(metrics?.impressions ?? 0);
        acc.conversions += Number(metrics?.conversions ?? 0);
        acc.revenue += Number(metrics?.conversions_value ?? 0);

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

  private async fetchDashboardRows(config: AdsConfig, includeLoginCustomerId: boolean) {
    const customer = this.getCustomer(config, includeLoginCustomerId);
    return Promise.all(PERIODS.map((period) => this.getRange(customer, period.range, period.label)));
  }

  private async listAccessibleCustomers(config: AdsConfig): Promise<string[]> {
    try {
      const client = this.getClient(config);
      const response = await client.listAccessibleCustomers(config.refreshToken);
      const resourceNames =
        (response as { resourceNames?: string[] }).resourceNames ??
        (response as { resource_names?: string[] }).resource_names ??
        [];

      return resourceNames.map((name) => name.replace("customers/", ""));
    } catch {
      return [];
    }
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
              id: "ads-roas",
              label: "ROAS",
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
    const config = this.getConfig();

    try {
      const data = await this.fetchDashboardRows(config, true);
      return this.buildDashboardData(data);
    } catch (initialError) {
      if (config.loginCustomerId && this.isPermissionError(initialError)) {
        try {
          const data = await this.fetchDashboardRows(config, false);

          console.warn(
            `[Google Ads] login_customer_id=${config.loginCustomerId} could not access customer ${config.customerId}. Retried without login_customer_id and succeeded.`
          );

          return this.buildDashboardData(data);
        } catch (retryError) {
          const accessibleCustomerIds = await this.listAccessibleCustomers(config);
          console.error("[Google Ads] Auth failed (with and without login_customer_id).", {
            customerId: config.customerId,
            loginCustomerId: config.loginCustomerId,
            accessibleCustomerIds,
            initialError: this.getErrorMessage(initialError),
            retryError: this.getErrorMessage(retryError)
          });
          return this.fallback();
        }
      }

      const accessibleCustomerIds = await this.listAccessibleCustomers(config);
      console.error("[Google Ads] Query failed.", {
        customerId: config.customerId,
        loginCustomerId: config.loginCustomerId,
        accessibleCustomerIds,
        error: this.getErrorMessage(initialError)
      });

      return this.fallback();
    }
  }
}

export const googleAdsService = new GoogleAdsService();
