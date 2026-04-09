import { redirect } from "next/navigation";

import { SectionHeader } from "@/components/dashboard/section-header";
import { CalendarDashboardClient } from "@/components/calendar/calendar-dashboard-client";
import { resolveDashboardAccessLevel, resolveDashboardRole } from "@/lib/access-control";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calendarService } from "@/server/services";

export default async function CalendarPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const email = (user.email ?? "").trim().toLowerCase();
  const accessLevel = resolveDashboardAccessLevel(email);
  const role = resolveDashboardRole(email);

  const initialEvents = await calendarService.listEvents({
    access: {
      role,
      userId: user.id,
      email
    }
  });

  if (accessLevel !== "full") {
    return (
      <div className="space-y-8">
        <SectionHeader
          title="My Calendar"
          description="Your private calendar. You can only see and manage your own entries."
        />
        <CalendarDashboardClient initialEvents={initialEvents} initialView="main" staffMode staffEmail={email} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Main Calendar"
        description="Operational scheduling with Dylan/John personal alignment merged into the main view."
      />
      <CalendarDashboardClient initialEvents={initialEvents} initialView="main" />
    </div>
  );
}
