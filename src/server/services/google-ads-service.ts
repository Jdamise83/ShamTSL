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
    return new GoogleAdsApi({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!
    });
  }

  private getCustomer() {
    const client = this.getClient();

    return client.Customer({
      customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID!,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
      login_customer_id: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID!
    });
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

      return {
        kpiGroups: [],
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
      throw error;
    }
  }
}

export const googleAdsService = new GoogleAdsService();