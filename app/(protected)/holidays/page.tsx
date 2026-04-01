import { SectionHeader } from "@/components/dashboard/section-header";
import { HolidayDashboardClient } from "@/components/holiday/holiday-dashboard-client";
import { holidayService } from "@/server/services";

export default async function HolidaysPage() {
  const [dashboardData, calendarEvents] = await Promise.all([
    holidayService.getDashboardData(),
    holidayService.getTeamHolidayCalendarEvents()
  ]);

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Holiday Management"
        description="Independent staff allowance tracking, request workflow, and full adjustment audit history."
      />

      <HolidayDashboardClient
        initialPayload={{
          ...dashboardData,
          calendarEvents
        }}
      />
    </div>
  );
}
