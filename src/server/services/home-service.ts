import "server-only";

import { googleAdsService } from "@/server/services/google-ads-service";
import { seoService } from "@/server/services/seo-service";
import { ga4Service } from "@/server/services/ga4-service";
import { shopifyService } from "@/server/services/shopify-service";
import { unleashedService } from "@/server/services/unleashed-service";
import { calendarService } from "@/server/services/calendar-service";
import { holidayService } from "@/server/services/holiday-service";
import type { Ga4Data, GoogleAdsData, SeoData, ShopifyData, UnleashedData } from "@/types/integrations";

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

const EMPTY_PERFORMANCE_DATA = {
  kpiGroups: [],
  charts: { trend: [], split: [] },
  tables: []
};

const EMPTY_ADS_DATA: GoogleAdsData = EMPTY_PERFORMANCE_DATA;
const EMPTY_SEO_DATA: SeoData = EMPTY_PERFORMANCE_DATA;
const EMPTY_GA4_DATA: Ga4Data = EMPTY_PERFORMANCE_DATA;
const EMPTY_SHOPIFY_DATA: ShopifyData = EMPTY_PERFORMANCE_DATA;
const EMPTY_UNLEASHED_DATA: UnleashedData = EMPTY_PERFORMANCE_DATA;

type OverviewPeriod = {
  id: "day" | "mtd" | "ytd";
  label: "Day" | "MTD" | "YTD";
  unleashedLabelToken: string;
  shopifyRowToken: string;
};

const OVERVIEW_PERIODS: OverviewPeriod[] = [
  { id: "day", label: "Day", unleashedLabelToken: "day", shopifyRowToken: "day" },
  { id: "mtd", label: "MTD", unleashedLabelToken: "month", shopifyRowToken: "month" },
  { id: "ytd", label: "YTD", unleashedLabelToken: "ytd", shopifyRowToken: "ytd" }
];

function toNumber(value: string | number | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number.isFinite(value) ? value : 0);
}

function extractUnleashedTotals(unleashed: UnleashedData, labelToken: string) {
  const group = unleashed.kpiGroups.find((item) =>
    item.label.toLowerCase().includes(labelToken.toLowerCase())
  );

  if (!group) {
    return { revenue: 0, profit: 0 };
  }

  const revenueMetric = group.metrics.find((metric) => metric.label.toLowerCase().includes("revenue"));
  const profitMetric = group.metrics.find((metric) => metric.label.toLowerCase().includes("profit"));

  return {
    revenue: toNumber(revenueMetric?.value),
    profit: toNumber(profitMetric?.value)
  };
}

function extractShopifyRevenueByPeriod(shopify: ShopifyData, periodToken: string) {
  const financialTable =
    shopify.tables.find((table) => table.key.toLowerCase().includes("financial")) ??
    shopify.tables.find((table) => table.title.toLowerCase().includes("financial"));

  if (!financialTable) {
    return 0;
  }

  const row = financialTable.rows.find((item) => {
    const periodValue = String(item.period ?? item.Period ?? "").toLowerCase();
    return periodValue.includes(periodToken.toLowerCase());
  });

  if (!row) {
    return 0;
  }

  return toNumber(String(row.revenue ?? row.Revenue ?? 0));
}

export const homeService = {
  async getOverview() {
    const [
      adsResult,
      seoResult,
      ga4Result,
      shopifyResult,
      unleashedResult,
      meetingsResult,
      upcomingEventsResult,
      upcomingTasksResult,
      holidayResult
    ] = await Promise.allSettled([
      withTimeout(googleAdsService.getDashboardData(), 15000, "Google Ads"),
      withTimeout(seoService.getDashboardData(), 15000, "SEO"),
      withTimeout(ga4Service.getDashboardData(), 15000, "GA4"),
      withTimeout(shopifyService.getDashboardData(), 15000, "Shopify"),
      withTimeout(unleashedService.getDashboardData(), 15000, "Unleashed"),
      withTimeout(calendarService.getUpcomingMeetings(3), 10000, "Calendar meetings"),
      withTimeout(calendarService.getUpcomingEvents(3), 10000, "Calendar events"),
      withTimeout(calendarService.getUpcomingTasks(3), 10000, "Calendar tasks"),
      withTimeout(holidayService.getDashboardData(), 10000, "Holidays")
    ]);

    const ads = adsResult.status === "fulfilled" ? adsResult.value : EMPTY_ADS_DATA;
    const seo = seoResult.status === "fulfilled" ? seoResult.value : EMPTY_SEO_DATA;
    const ga4 = ga4Result.status === "fulfilled" ? ga4Result.value : EMPTY_GA4_DATA;
    const shopify = shopifyResult.status === "fulfilled" ? shopifyResult.value : EMPTY_SHOPIFY_DATA;
    const unleashed =
      unleashedResult.status === "fulfilled" ? unleashedResult.value : EMPTY_UNLEASHED_DATA;
    const meetings = meetingsResult.status === "fulfilled" ? meetingsResult.value : [];
    const upcomingEvents = upcomingEventsResult.status === "fulfilled" ? upcomingEventsResult.value : [];
    const upcomingTasks = upcomingTasksResult.status === "fulfilled" ? upcomingTasksResult.value : [];
    const holidaySummary =
      holidayResult.status === "fulfilled"
        ? holidayResult.value.summary
        : {
            staffOnLeaveToday: 0,
            pendingRequests: 0,
            approvedThisMonth: 0,
            remainingAllowanceTotal: "-"
          };

    if (adsResult.status === "rejected") {
      console.error("[Home] Google Ads module failed:", adsResult.reason);
    }
    if (seoResult.status === "rejected") {
      console.error("[Home] SEO module failed:", seoResult.reason);
    }
    if (ga4Result.status === "rejected") {
      console.error("[Home] GA4 module failed:", ga4Result.reason);
    }
    if (shopifyResult.status === "rejected") {
      console.error("[Home] Shopify module failed:", shopifyResult.reason);
    }
    if (unleashedResult.status === "rejected") {
      console.error("[Home] Unleashed module failed:", unleashedResult.reason);
    }
    if (holidayResult.status === "rejected") {
      console.error("[Home] Holidays module failed:", holidayResult.reason);
    }

    const monthGroup =
      unleashed.kpiGroups.find((group) => group.label.toLowerCase().includes("month")) ??
      unleashed.kpiGroups[unleashed.kpiGroups.length - 1];

    const combinedTopKpis = OVERVIEW_PERIODS.flatMap((period) => {
      const unleashedTotals = extractUnleashedTotals(unleashed, period.unleashedLabelToken);
      const shopifyRevenue = extractShopifyRevenueByPeriod(shopify, period.shopifyRowToken);
      const combinedRevenue = unleashedTotals.revenue + shopifyRevenue;
      const combinedProfit = unleashedTotals.profit + shopifyRevenue * 0.5;

      return [
        {
          id: `${period.id}-revenue`,
          label: `${period.label} Revenue`,
          value: formatCurrency(combinedRevenue),
          helperText: "Shopify + Unleashed"
        },
        {
          id: `${period.id}-profit`,
          label: `${period.label} Profit`,
          value: formatCurrency(combinedProfit),
          helperText: "Unleashed profit + 50% Shopify revenue"
        }
      ];
    });

    const ga4RevenueMetric =
      ga4.kpiGroups[0]?.metrics.find((metric) => metric.id === "ga4-revenue") ??
      ga4.kpiGroups[0]?.metrics.find((metric) => metric.label.toLowerCase().includes("revenue"));

    const shopifyMtdRevenue = extractShopifyRevenueByPeriod(shopify, "month");

    return {
      topKpis: combinedTopKpis,

      upcomingMeetings: meetings,
      upcomingEvents,
      upcomingTasks,

      holidaySummary,

      moduleSnapshots: [
        {
          id: "google-ads",
          label: "Google Ads",
          value:
            ads.kpiGroups[0]?.metrics.find((metric) => metric.id.includes("roas"))?.value ?? "-",
          helper: "Today ROAS"
        },

        {
          id: "seo",
          label: "SEO",
          value: seo.kpiGroups[0]?.metrics[0]?.value ?? "-",
          helper: "Last 7D Clicks"
        },

        {
          id: "ga4",
          label: "GA4",
          value: ga4RevenueMetric?.value ?? "-",
          helper: "Last 30D Revenue"
        },
        {
          id: "shopify",
          label: "Shopify",
          value: formatCurrency(shopifyMtdRevenue),
          helper: "Month to date Revenue"
        },

        {
          id: "unleashed",
          label: "Unleashed",
          value:
            monthGroup?.metrics.find((metric) => metric.label.toLowerCase().includes("revenue"))?.value ??
            "-",
          helper: "Month to date Revenue"
        }
      ]
    };
  }
};
