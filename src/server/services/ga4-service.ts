import "server-only";

import { BetaAnalyticsDataClient } from "@google-analytics/data";

import type { Ga4Data } from "@/types/integrations";

export interface Ga4Provider {
  getDashboardData(): Promise<Ga4Data>;
}

class RealGa4Provider implements Ga4Provider {
  private getClient() {
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!clientEmail) {
      throw new Error("Missing GOOGLE_CLIENT_EMAIL");
    }

    if (!privateKey) {
      throw new Error("Missing GOOGLE_PRIVATE_KEY");
    }

    return new BetaAnalyticsDataClient({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey
      }
    });
  }

  private getFallbackData(): Ga4Data {
    return {
      kpiGroups: [
        {
          id: "ga4-overview",
          label: "GA4 Overview",
          metrics: [
            {
              id: "ga4-active-users",
              label: "Active Users",
              value: "-",
              change: undefined
            },
            {
              id: "ga4-sessions",
              label: "Sessions",
              value: "-",
              change: undefined
            },
            {
              id: "ga4-revenue",
              label: "Revenue",
              value: "-",
              change: undefined
            }
          ]
        }
      ],
      charts: [],
      tables: []
    } as unknown as Ga4Data;
  }

  async getDashboardData(): Promise<Ga4Data> {
    try {
      const propertyId = process.env.GA4_PROPERTY_ID;

      if (!propertyId) {
        throw new Error("Missing GA4_PROPERTY_ID");
      }

      const client = this.getClient();

      const [yesterdayReport] = await client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: "yesterday", endDate: "yesterday" }],
        metrics: [{ name: "totalRevenue" }]
      });

      const [sevenDayReport] = await client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
        metrics: [
          { name: "activeUsers" },
          { name: "sessions" },
          { name: "totalRevenue" }
        ]
      });

      const revenueYesterday = Number(
        yesterdayReport.rows?.[0]?.metricValues?.[0]?.value ?? 0
      );

      const activeUsers = Number(
        sevenDayReport.rows?.[0]?.metricValues?.[0]?.value ?? 0
      );

      const sessions = Number(
        sevenDayReport.rows?.[0]?.metricValues?.[1]?.value ?? 0
      );

      const result = {
        kpiGroups: [
          {
            id: "ga4-overview",
            label: "GA4 Overview",
            metrics: [
              {
                id: "ga4-active-users",
                label: "Active Users",
                value: activeUsers.toLocaleString(),
                change: undefined
              },
              {
                id: "ga4-sessions",
                label: "Sessions",
                value: sessions.toLocaleString(),
                change: undefined
              },
              {
                id: "ga4-revenue",
                label: "Revenue",
                value: `£${Math.round(revenueYesterday).toLocaleString()}`,
                change: undefined
              }
            ]
          }
        ],
        charts: [],
        tables: []
      };

      return result as unknown as Ga4Data;
    } catch (error) {
      console.error("GA4 runtime error:", error);
      return this.getFallbackData();
    }
  }
}

export class Ga4Service {
  constructor(private readonly provider: Ga4Provider) {}

  async getDashboardData() {
    return this.provider.getDashboardData();
  }
}

export const ga4Service = new Ga4Service(new RealGa4Provider());