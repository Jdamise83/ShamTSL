import { SectionHeader } from "@/components/dashboard/section-header";
import { CalendarDashboardClient } from "@/components/calendar/calendar-dashboard-client";
import { calendarService } from "@/server/services";

export default async function CalendarPage() {
  const initialEvents = await calendarService.listEvents();

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Calendar"
        description="Operational scheduling with full event lifecycle control and attendee management."
      />
      <CalendarDashboardClient initialEvents={initialEvents} />
    </div>
  );
}
