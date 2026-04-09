import { NextRequest, NextResponse } from "next/server";

import { resolveDashboardRole } from "@/lib/access-control";
import { hasSupabaseBrowserConfig } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calendarService } from "@/server/services";
import type { CalendarEvent } from "@/types/calendar";
import type { CalendarEventInput } from "@/types/calendar";

type AuthContext = {
  user: {
    id: string;
    email?: string | null;
  };
  role: "admin" | "staff";
  email: string;
};

async function ensureAuthenticated(): Promise<AuthContext | null> {
  if (!hasSupabaseBrowserConfig()) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const email = (user.email ?? "").trim().toLowerCase();
  const role = resolveDashboardRole(email);

  return {
    user: {
      id: user.id,
      email: user.email
    },
    role,
    email
  };
}

function canStaffManageEvent(event: CalendarEvent, context: AuthContext) {
  if (context.role !== "staff") {
    return true;
  }

  if (event.calendarScope !== "personal") {
    return false;
  }

  const emailLocalPart = context.email.split("@")[0] ?? "";
  const ownerEmailMatches = event.ownerEmail ? event.ownerEmail.toLowerCase() === context.email : false;
  const ownerLocalPartMatches = event.personalOwner ? event.personalOwner.toLowerCase() === emailLocalPart : false;
  const createdByMatches = event.createdBy === context.user.id;

  return ownerEmailMatches || ownerLocalPartMatches || createdByMatches;
}

function withStaffCalendarRestrictions(input: CalendarEventInput, context: AuthContext): CalendarEventInput {
  if (context.role !== "staff") {
    return input;
  }

  return {
    ...input,
    calendarScope: "personal",
    personalOwner: null,
    brandCampaignType: null,
    allDay: false,
    notifyBoth: false,
    ownerEmail: context.email
  };
}

export async function GET(request: NextRequest) {
  const context = await ensureAuthenticated();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = request.nextUrl.searchParams.get("start") ?? undefined;
  const end = request.nextUrl.searchParams.get("end") ?? undefined;
  const statuses = request.nextUrl.searchParams.get("statuses")?.split(",").filter(Boolean) ?? [];

  const events = await calendarService.listEvents({
    start,
    end,
    filters: { statuses: statuses as CalendarEventInput["status"][] },
    access: {
      role: context.role,
      userId: context.user.id,
      email: context.email
    }
  });

  return NextResponse.json({ events });
}

export async function POST(request: NextRequest) {
  const context = await ensureAuthenticated();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as CalendarEventInput;
  const payload = withStaffCalendarRestrictions(body, context);

  const created = await calendarService.createEvent(payload, context.user.id);
  return NextResponse.json({ event: created }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const context = await ensureAuthenticated();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    id: string;
    mode: "timing" | "full";
    startsAt?: string;
    endsAt?: string;
    event?: CalendarEventInput;
  };

  if (!body.id) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const existing = await calendarService.getEventById(body.id);
  if (!existing) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (!canStaffManageEvent(existing, context)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (body.mode === "timing" && body.startsAt && body.endsAt) {
    const event = await calendarService.updateEventTimes(body.id, body.startsAt, body.endsAt);
    return NextResponse.json({ event });
  }

  if (body.mode === "full" && body.event) {
    const payload = withStaffCalendarRestrictions(body.event, context);
    const event = await calendarService.updateEvent(body.id, payload);
    return NextResponse.json({ event });
  }

  return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
}

export async function DELETE(request: NextRequest) {
  const context = await ensureAuthenticated();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const existing = await calendarService.getEventById(id);
  if (!existing) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (!canStaffManageEvent(existing, context)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await calendarService.deleteEvent(id);
  return NextResponse.json({ ok: true });
}
