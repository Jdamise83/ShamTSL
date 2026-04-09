import { redirect } from "next/navigation";

import { CalendarDashboardClient } from "@/components/calendar/calendar-dashboard-client";
import { SectionHeader } from "@/components/dashboard/section-header";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calendarService } from "@/server/services";

export default async function BrandCampaignCalendarPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role === "staff") {
    redirect("/calendar");
  }

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
