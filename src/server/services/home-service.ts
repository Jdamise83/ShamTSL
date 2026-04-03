import "server-only";

import { googleAdsService } from "@/server/services/google-ads-service";
import { seoService } from "@/server/services/seo-service";
import { ga4Service } from "@/server/services/ga4-service";
import { unleashedService } from "@/server/services/unleashed-service";
import { calendarService } from "@/server/services/calendar-service";
import { holidayService } from "@/server/services/holiday-service";

export const homeService = {
  async getOverview() {
    const [ads, seo, ga4, unleashed, meetings, upcomingEvents, upcomingTasks, holiday] = await Promise.all([
      googleAdsService.getDashboardData(),
      seoService.getDashboardData(),
      ga4Service.getDashboardData(),
      unleashedService.getDashboardData(),
      calendarService.getUpcomingMeetings(3),
      calendarService.getUpcomingEvents(3),
      calendarService.getUpcomingTasks(3),
      holidayService.getDashboardData()
    ]);

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

      holidaySummary: holiday.summary,

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
            unleashed.kpiGroups[1]?.metrics.find((metric) => metric.label === "Gross Profit")?.value ??
            "-",
          helper: "MTD Gross Profit"
        }
      ]
    };
  }
};
