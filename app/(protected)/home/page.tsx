import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarDays, ListTodo, Rocket, Umbrella } from "lucide-react";

import { KpiCard } from "@/components/dashboard/kpi-card";
import { RangeLabel } from "@/components/dashboard/range-label";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { homeService } from "@/server/services";
import type { CalendarEvent } from "@/types/calendar";

function formatCalendarItemRange(item: CalendarEvent) {
  const startDate = new Date(item.startsAt);
  const endDate = new Date(item.endsAt);

  if (item.allDay) {
    const endDisplay = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
    const startLabel = startDate.toLocaleDateString();
    const endLabel = endDisplay.toLocaleDateString();
    return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
  }

  return `${startDate.toLocaleString()} - ${endDate.toLocaleTimeString()}`;
}

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "staff") {
    redirect("/holidays");
  }

  const data = await homeService.getOverview();

  return (
    <div className="space-y-8">
      <SectionHeader
        title="C-Suite Dashboard"
        description="Quick Dashboard For The Team"
      />

      <section className="space-y-3">
        <RangeLabel label="Overview Snapshot" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-2">
          {data.topKpis.map((kpi) => (
            <KpiCard key={kpi.id} metric={kpi} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <RangeLabel label="Upcoming Schedule" />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card className="border-border/80 bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base uppercase tracking-[0.08em]">
                <CalendarDays className="h-4 w-4 text-primary" />
                Upcoming Meetings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.upcomingMeetings.length ? (
                data.upcomingMeetings.map((meeting) => (
                  <div key={meeting.id} className="rounded-xl border border-border/70 bg-muted/40 px-4 py-3">
                    <p className="text-sm font-semibold text-foreground">{meeting.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatCalendarItemRange(meeting)}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{meeting.location ?? "No location"}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No upcoming meetings.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base uppercase tracking-[0.08em]">
                <Rocket className="h-4 w-4 text-primary" />
                Upcoming Events
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.upcomingEvents.length ? (
                data.upcomingEvents.map((event) => (
                  <div key={event.id} className="rounded-xl border border-border/70 bg-muted/40 px-4 py-3">
                    <p className="text-sm font-semibold text-foreground">{event.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatCalendarItemRange(event)}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{event.description ?? "No description"}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No upcoming events.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base uppercase tracking-[0.08em]">
                <ListTodo className="h-4 w-4 text-primary" />
                Upcoming Tasks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.upcomingTasks.length ? (
                data.upcomingTasks.map((task) => (
                  <div key={task.id} className="rounded-xl border border-border/70 bg-muted/40 px-4 py-3">
                    <p className="text-sm font-semibold text-foreground">{task.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatCalendarItemRange(task)}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{task.internalNotes ?? "No notes"}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No upcoming tasks.</p>
              )}
              <Link
                href="/calendar"
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
              >
                Open Calendar
                <ArrowRight className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      <Card className="border-border/80 bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base uppercase tracking-[0.08em]">
            <Umbrella className="h-4 w-4 text-primary" />
            Holiday Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-muted/60 p-4">
            <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">On Leave Today</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{data.holidaySummary.staffOnLeaveToday}</p>
          </div>
          <div className="rounded-xl bg-muted/60 p-4">
            <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Pending Requests</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{data.holidaySummary.pendingRequests}</p>
          </div>
          <div className="rounded-xl bg-muted/60 p-4">
            <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Approved (Month)</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{data.holidaySummary.approvedThisMonth}</p>
          </div>
          <div className="rounded-xl bg-muted/60 p-4">
            <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Allowance Remaining</p>
            <p className="mt-2 text-2xl font-semibold text-primary">
              {data.holidaySummary.remainingAllowanceTotal}
            </p>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <RangeLabel label="Performance Snapshot" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {data.moduleSnapshots.map((snapshot) => (
            <Link key={snapshot.id} href={`/${snapshot.id}`}>
              <Card className="h-full border-border/80 bg-card transition-all hover:-translate-y-0.5 hover:shadow-lg">
                <CardContent className="space-y-2 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {snapshot.label}
                  </p>
                  <p className="text-2xl font-semibold text-foreground">{snapshot.value}</p>
                  <p className="text-xs text-muted-foreground">{snapshot.helper}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
