import { CalendarDashboardClient } from "@/components/calendar/calendar-dashboard-client";
import { SectionHeader } from "@/components/dashboard/section-header";
import { calendarService } from "@/server/services";

export default async function PersonalCalendarPage() {
  const initialEvents = await calendarService.listEvents();

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Personal Calendar"
        description="Individual calendars for Dylan and John with shared attendance and sync into Main Calendar."
      />
      <CalendarDashboardClient initialEvents={initialEvents} initialView="personal" />
    </div>
  );
}
