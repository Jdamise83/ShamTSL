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

  private fallback(): Ga4Data {
    return {
      kpiGroups: [
        {
          id: "ga4-overview",
          label: "GA4 Overview",
          metrics: [
            {
              id: "ga4-users",
              label: "Active Users (Last 30 Days)",
              value: "-",
              change: undefined
            },
            {
              id: "ga4-sessions",
              label: "Sessions (Last 30 Days)",
              value: "-",
              change: undefined
            },
            {
              id: "ga4-revenue",
              label: "Revenue (Last 30 Days)",
              value: "-",
              change: undefined
            }
          ]
        }
      ],
      charts: {
        trend: [
          { label: "Jan", value: 0 },
          { label: "Feb", value: 0 },
          { label: "Mar", value: 0 }
        ],
        split: [
          { label: "Google Ads", value: 0 },
          { label: "Organic Search", value: 0 },
          { label: "Direct", value: 0 },
          { label: "Referral", value: 0 }
        ]
      },
      tables: []
    };
  }

  async getDashboardData(): Promise<Ga4Data> {
    try {
      const propertyId = process.env.GA4_PROPERTY_ID;

      if (!propertyId) {
        throw new Error("Missing GA4_PROPERTY_ID");
      }

      const client = this.getClient();

      const [overviewReport] = await client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
        metrics: [
          { name: "activeUsers" },
          { name: "sessions" },
          { name: "totalRevenue" }
        ]
      });

      const [monthlyTrendReport] = await client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: "2026-01-01", endDate: "today" }],
        dimensions: [{ name: "month" }],
        metrics: [{ name: "sessions" }],
        orderBys: [
          {
            dimension: {
              dimensionName: "month"
            }
          }
        ]
      });

      const [acquisitionReport] = await client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        metrics: [{ name: "sessions" }],
        limit: 20
      });

      const activeUsers = Number(
        overviewReport.rows?.[0]?.metricValues?.[0]?.value ?? 0
      );

      const sessions = Number(
        overviewReport.rows?.[0]?.metricValues?.[1]?.value ?? 0
      );

      const revenue = Number(
        overviewReport.rows?.[0]?.metricValues?.[2]?.value ?? 0
      );

      const monthMap: Record<string, number> = {
        "01": 0,
        "02": 0,
        "03": 0
      };

      for (const row of monthlyTrendReport.rows ?? []) {
        const month = row.dimensionValues?.[0]?.value ?? "";
        const value = Number(row.metricValues?.[0]?.value ?? 0);

        if (month in monthMap) {
          monthMap[month] = value;
        }
      }

      const trend = [
        { label: "Jan", value: monthMap["01"] ?? 0 },
        { label: "Feb", value: monthMap["02"] ?? 0 },
        { label: "Mar", value: monthMap["03"] ?? 0 }
      ];

      const splitCounts: Record<string, number> = {
        "Google Ads": 0,
        "Organic Search": 0,
        "Direct": 0,
        "Referral": 0
      };

      for (const row of acquisitionReport.rows ?? []) {
        const channel = row.dimensionValues?.[0]?.value ?? "";
        const value = Number(row.metricValues?.[0]?.value ?? 0);

        if (channel === "Paid Search") {
          splitCounts["Google Ads"] += value;
        } else if (channel === "Organic Search") {
          splitCounts["Organic Search"] += value;
        } else if (channel === "Direct") {
          splitCounts["Direct"] += value;
        } else if (channel === "Referral") {
          splitCounts["Referral"] += value;
        }
      }

      const totalSplitSessions = Object.values(splitCounts).reduce((sum, value) => sum + value, 0);

      const toPercent = (value: number) => {
        if (totalSplitSessions === 0) {
          return 0;
        }

        return Math.round((value / totalSplitSessions) * 100);
      };

      return {
        kpiGroups: [
          {
            id: "ga4-overview",
            label: "GA4 Overview",
            metrics: [
              {
                id: "ga4-users",
                label: "Active Users (Last 30 Days)",
                value: activeUsers.toLocaleString(),
                change: undefined
              },
              {
                id: "ga4-sessions",
                label: "Sessions (Last 30 Days)",
                value: sessions.toLocaleString(),
                change: undefined
              },
              {
                id: "ga4-revenue",
                label: "Revenue (Last 30 Days)",
                value: `£${Math.round(revenue).toLocaleString()}`,
                change: undefined
              }
            ]
          }
        ],
        charts: {
          trend,
          split: [
            { label: "Google Ads", value: toPercent(splitCounts["Google Ads"]) },
            { label: "Organic Search", value: toPercent(splitCounts["Organic Search"]) },
            { label: "Direct", value: toPercent(splitCounts["Direct"]) },
            { label: "Referral", value: toPercent(splitCounts["Referral"]) }
          ]
        },
        tables: []
      };
    } catch (error) {
      console.error("GA4 runtime error:", error);
      return this.fallback();
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