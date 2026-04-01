import { NextRequest, NextResponse } from "next/server";

import { hasSupabaseBrowserConfig } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { holidayService } from "@/server/services";
import type { HolidayAdjustmentInput, HolidayRequestInput, HolidayRequestStatus } from "@/types/holiday";

async function getAuthenticatedUser() {
  if (!hasSupabaseBrowserConfig()) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return user;
}

async function getDashboardPayload() {
  const dashboard = await holidayService.getDashboardData();
  const calendarEvents = await holidayService.getTeamHolidayCalendarEvents();

  return {
    ...dashboard,
    calendarEvents
  };
}

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await getDashboardPayload();
  return NextResponse.json(payload);
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as
    | { action: "request"; payload: HolidayRequestInput }
    | { action: "review"; payload: { requestId: string; status: HolidayRequestStatus } }
    | { action: "adjust"; payload: HolidayAdjustmentInput };

  if (body.action === "request") {
    await holidayService.createHolidayRequest(body.payload);
  }

  if (body.action === "review") {
    await holidayService.reviewHolidayRequest(body.payload.requestId, body.payload.status, user.id);
  }

  if (body.action === "adjust") {
    await holidayService.applyAdjustment(body.payload, user.id);
  }

  const payload = await getDashboardPayload();
  return NextResponse.json(payload);
}
