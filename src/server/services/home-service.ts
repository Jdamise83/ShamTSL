import "server-only";

import { googleAdsService } from "@/server/services/google-ads-service";
import { seoService } from "@/server/services/seo-service";
import { ga4Service } from "@/server/services/ga4-service";
import { unleashedService } from "@/server/services/unleashed-service";
import { calendarService } from "@/server/services/calendar-service";
import { holidayService } from "@/server/services/holiday-service";
import type { Ga4Data, GoogleAdsData, SeoData, UnleashedData } from "@/types/integrations";

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
const EMPTY_UNLEASHED_DATA: UnleashedData = EMPTY_PERFORMANCE_DATA;

export const homeService = {
  async getOverview() {
    const [
      adsResult,
      seoResult,
      ga4Result,
      unleashedResult,
      meetingsResult,
      upcomingEventsResult,
      upcomingTasksResult,
      holidayResult
    ] = await Promise.allSettled([
      withTimeout(googleAdsService.getDashboardData(), 15000, "Google Ads"),
      withTimeout(seoService.getDashboardData(), 15000, "SEO"),
      withTimeout(ga4Service.getDashboardData(), 15000, "GA4"),
      withTimeout(unleashedService.getDashboardData(), 15000, "Unleashed"),
      withTimeout(calendarService.getUpcomingMeetings(3), 10000, "Calendar meetings"),
      withTimeout(calendarService.getUpcomingEvents(3), 10000, "Calendar events"),
      withTimeout(calendarService.getUpcomingTasks(3), 10000, "Calendar tasks"),
      withTimeout(holidayService.getDashboardData(), 10000, "Holidays")
    ]);

    const ads = adsResult.status === "fulfilled" ? adsResult.value : EMPTY_ADS_DATA;
    const seo = seoResult.status === "fulfilled" ? seoResult.value : EMPTY_SEO_DATA;
    const ga4 = ga4Result.status === "fulfilled" ? ga4Result.value : EMPTY_GA4_DATA;
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
    if (unleashedResult.status === "rejected") {
      console.error("[Home] Unleashed module failed:", unleashedResult.reason);
    }
    if (holidayResult.status === "rejected") {
      console.error("[Home] Holidays module failed:", holidayResult.reason);
    }

    const monthGroup =
      unleashed.kpiGroups.find((group) => group.label.toLowerCase().includes("month")) ??
      unleashed.kpiGroups[unleashed.kpiGroups.length - 1];

    return {
      topKpis: [
        { id: "today", label: "Today", value: "£24,300", change: { value: 4.6, direction: "up" as const } },
        { id: "wtd", label: "WTD", value: "£158,200", change: { value: 6.1, direction: "up" as const } },
        { id: "mtd", label: "MTD", value: "£672,400", change: { value: 7.4, direction: "up" as const } },
        { id: "ytd", label: "YTD", value: "£7.4M", change: { value: 11.2, direction: "up" as const } }
      ],

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
          value:
            ga4.kpiGroups[0]?.metrics.find((metric) => metric.id === "ga4-active-users")?.value ??
            "-",
          helper: `${
            ga4.kpiGroups[0]?.metrics.find((metric) => metric.id === "ga4-sessions")?.value ?? "-"
          } sessions | ${
            ga4.kpiGroups[0]?.metrics.find((metric) => metric.id === "ga4-revenue")?.value ?? "-"
          }`
        },

        {
          id: "unleashed",
          label: "Unleashed",
          value:
            monthGroup?.metrics.find((metric) => metric.label.toLowerCase().includes("profit"))?.value ??
            "-",
          helper: "Month to date Total Profit"
        }
      ]
    };
  }
};
