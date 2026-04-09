import { redirect } from "next/navigation";

import { CalendarDashboardClient } from "@/components/calendar/calendar-dashboard-client";
import { SectionHeader } from "@/components/dashboard/section-header";
import { resolveDashboardAccessLevel } from "@/lib/access-control";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calendarService } from "@/server/services";

export default async function PersonalCalendarPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (resolveDashboardAccessLevel(user.email) !== "full") {
    redirect("/calendar");
  }

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
