import "server-only";

import { BetaAnalyticsDataClient } from "@google-analytics/data";

const propertyId = process.env.GA4_PROPERTY_ID;
const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

function getClient() {
  if (!propertyId) {
    throw new Error("Missing GA4_PROPERTY_ID");
  }

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

function getMetricValue(
  row: { metricValues?: Array<{ value?: string | null }> } | undefined,
  index: number
) {
  return Number(row?.metricValues?.[index]?.value ?? 0);
}

export async function getGA4Overview() {
  const client = getClient();

  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
    metrics: [
      { name: "activeUsers" },
      { name: "sessions" },
      { name: "totalRevenue" }
    ]
  });

  const row = response.rows?.[0];

  return {
    activeUsers: getMetricValue(row, 0),
    sessions: getMetricValue(row, 1),
    totalRevenue: getMetricValue(row, 2)
  };
}