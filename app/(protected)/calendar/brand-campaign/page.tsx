import { CalendarDashboardClient } from "@/components/calendar/calendar-dashboard-client";
import { SectionHeader } from "@/components/dashboard/section-header";
import { calendarService } from "@/server/services";

export default async function BrandCampaignCalendarPage() {
  const initialEvents = await calendarService.listEvents();

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Brand & Campaign Calendar"
        description="Light green campaign windows and light blue brand windows with multi-day span blocks."
      />
      <CalendarDashboardClient initialEvents={initialEvents} initialView="brand-campaign" />
    </div>
  );
}
