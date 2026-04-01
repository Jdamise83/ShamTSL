import { NextRequest, NextResponse } from "next/server";

import { hasSupabaseBrowserConfig } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calendarService } from "@/server/services";
import type { CalendarEventInput } from "@/types/calendar";

async function ensureAuthenticated() {
  if (!hasSupabaseBrowserConfig()) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return user;
}

export async function GET(request: NextRequest) {
  const user = await ensureAuthenticated();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = request.nextUrl.searchParams.get("start") ?? undefined;
  const end = request.nextUrl.searchParams.get("end") ?? undefined;
  const statuses = request.nextUrl.searchParams.get("statuses")?.split(",").filter(Boolean) ?? [];

  const events = await calendarService.listEvents({
    start,
    end,
    filters: { statuses: statuses as CalendarEventInput["status"][] }
  });

  return NextResponse.json({ events });
}

export async function POST(request: NextRequest) {
  const user = await ensureAuthenticated();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as CalendarEventInput;

  const created = await calendarService.createEvent(body, user.id);
  return NextResponse.json({ event: created }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const user = await ensureAuthenticated();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    id: string;
    mode: "timing" | "full";
    startsAt?: string;
    endsAt?: string;
    event?: CalendarEventInput;
  };

  if (body.mode === "timing" && body.id && body.startsAt && body.endsAt) {
    const event = await calendarService.updateEventTimes(body.id, body.startsAt, body.endsAt);
    return NextResponse.json({ event });
  }

  if (body.mode === "full" && body.id && body.event) {
    const event = await calendarService.updateEvent(body.id, body.event);
    return NextResponse.json({ event });
  }

  return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
}

export async function DELETE(request: NextRequest) {
  const user = await ensureAuthenticated();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  await calendarService.deleteEvent(id);
  return NextResponse.json({ ok: true });
}
