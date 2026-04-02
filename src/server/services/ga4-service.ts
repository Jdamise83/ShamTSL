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

  async getDashboardData(): Promise<Ga4Data> {
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

    const totalRevenue = Number(
      sevenDayReport.rows?.[0]?.metricValues?.[2]?.value ?? 0
    );

    return {
      kpiGroups: [
        {
          id: "ga4-overview",
          title: "GA4 Overview",
          metrics: [
            {
              id: "ga4-active-users",
              label: "Active Users",
              value: activeUsers.toLocaleString(),
              change: null
            },
            {
              id: "ga4-sessions",
              label: "Sessions",
              value: sessions.toLocaleString(),
              change: null
            },
            {
              id: "ga4-revenue",
              label: "Revenue",
              value: `£${Math.round(revenueYesterday).toLocaleString()}`,
              change: null
            }
          ]
        }
      ],
      charts: [],
      tables: [],
      activeUsers,
      sessions,
      totalRevenue
    } as Ga4Data & {
      activeUsers: number;
      sessions: number;
      totalRevenue: number;
    };
  }
}

export class Ga4Service {
  constructor(private readonly provider: Ga4Provider) {}

  async getDashboardData() {
    return this.provider.getDashboardData();
  }
}

export const ga4Service = new Ga4Service(new RealGa4Provider());