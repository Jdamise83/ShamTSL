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

export class GoogleAdsService {
  private getClient() {
    const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

    if (!clientId) {
      throw new Error("Missing GOOGLE_ADS_CLIENT_ID");
    }

    if (!clientSecret) {
      throw new Error("Missing GOOGLE_ADS_CLIENT_SECRET");
    }

    if (!developerToken) {
      throw new Error("Missing GOOGLE_ADS_DEVELOPER_TOKEN");
    }

    return new GoogleAdsApi({
      client_id: clientId,
      client_secret: clientSecret,
      developer_token: developerToken
    });
  }

  private getCustomer() {
    const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
    const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
    const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;

    if (!customerId) {
      throw new Error("Missing GOOGLE_ADS_CUSTOMER_ID");
    }

    if (!refreshToken) {
      throw new Error("Missing GOOGLE_ADS_REFRESH_TOKEN");
    }

    if (!loginCustomerId) {
      throw new Error("Missing GOOGLE_ADS_LOGIN_CUSTOMER_ID");
    }

    const client = this.getClient();

    return client.Customer({
      customer_id: customerId,
      refresh_token: refreshToken,
      login_customer_id: loginCustomerId
    });
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
              Revenue: "-",
              ROAS: "-"
            },
            {
              Period: "Yesterday",
              Spend: "-",
              Clicks: "-",
              Impressions: "-",
              Conversions: "-",
              Revenue: "-",
              ROAS: "-"
            },
            {
              Period: "Last 7 days",
              Spend: "-",
              Clicks: "-",
              Impressions: "-",
              Conversions: "-",
              Revenue: "-",
              ROAS: "-"
            },
            {
              Period: "Month to date",
              Spend: "-",
              Clicks: "-",
              Impressions: "-",
              Conversions: "-",
              Revenue: "-",
              ROAS: "-"
            }
          ]
        }
      ]
    };
  }

  async getDashboardData(): Promise<GoogleAdsData> {
    try {
      const customer = this.getCustomer();

      const getRange = async (dateRange: string, label: string) => {
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
      };

      const data = await Promise.all([
        getRange("TODAY", "Today"),
        getRange("YESTERDAY", "Yesterday"),
        getRange("LAST_7_DAYS", "Last 7 days"),
        getRange("THIS_MONTH", "Month to date")
      ]);

      const monthToDate = data.find((row) => row.period === "Month to date");

      return {
        kpiGroups: [
          {
            id: "google-ads-overview",
            label: "Google Ads Overview",
            metrics: [
              {
                id: "ads-spend",
                label: "Spend (Month to date)",
                value: `£${(monthToDate?.spend ?? 0).toFixed(2)}`,
                change: undefined
              },
              {
                id: "ads-clicks",
                label: "Clicks (Month to date)",
                value: `${monthToDate?.clicks ?? 0}`,
                change: undefined
              },
              {
                id: "ads-roas",
                label: "ROAS (Month to date)",
                value: `${(monthToDate?.roas ?? 0).toFixed(2)}x`,
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
            rows: data.map((row) => ({
              Period: row.period,
              Spend: `£${row.spend.toFixed(2)}`,
              Clicks: row.clicks,
              Impressions: row.impressions,
              Conversions: row.conversions,
              Revenue: `£${row.revenue.toFixed(2)}`,
              ROAS: `${row.roas.toFixed(2)}x`
            }))
          }
        ]
      };
    } catch (error) {
      console.error("GOOGLE ADS ERROR:", error);
      return this.fallback();
    }
  }
}

export const googleAdsService = new GoogleAdsService();