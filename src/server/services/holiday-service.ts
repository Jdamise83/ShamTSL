import "server-only";

import { addDays, formatISO, getDaysInMonth, isWithinInterval, parseISO } from "date-fns";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  seededHolidayAdjustments,
  seededHolidayRequests,
  seededStaffMembers
} from "@/server/data/holiday";
import type {
  HolidayAdjustment,
  HolidayAdjustmentInput,
  HolidayRequest,
  HolidayRequestInput,
  HolidayRequestStatus,
  StaffMember,
  TeamHolidaySummary
} from "@/types/holiday";

let inMemoryStaff: StaffMember[] = structuredClone(seededStaffMembers);
let inMemoryRequests: HolidayRequest[] = structuredClone(seededHolidayRequests);
let inMemoryAdjustments: HolidayAdjustment[] = structuredClone(seededHolidayAdjustments);

function mapStaffRow(row: any): StaffMember {
  const balance = Array.isArray(row.holiday_balances) ? row.holiday_balances[0] : row.holiday_balances;

  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    roleTitle: row.role_title,
    annualAllowance: balance?.annual_allowance ?? 0,
    usedHoliday: balance?.used_holiday ?? 0,
    remainingHoliday: balance?.remaining_holiday ?? 0,
    creditedHoliday: balance?.credited_holiday ?? 0,
    removedHoliday: balance?.removed_holiday ?? 0,
    manualAdjustments: balance?.manual_adjustments ?? 0,
    pendingRequests: balance?.pending_requests ?? 0,
    approvedRequests: balance?.approved_requests ?? 0,
    rejectedRequests: balance?.rejected_requests ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapRequestRow(row: any): HolidayRequest {
  return {
    id: row.id,
    staffMemberId: row.staff_member_id,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    daysRequested: row.days_requested,
    reason: row.reason,
    status: row.status,
    requestedAt: row.requested_at,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by
  };
}

function mapAdjustmentRow(row: any): HolidayAdjustment {
  return {
    id: row.id,
    staffMemberId: row.staff_member_id,
    adjustmentType: row.adjustment_type,
    amountDays: row.amount_days,
    reason: row.reason,
    createdBy: row.created_by,
    createdAt: row.created_at
  };
}

function calculateBusinessDays(startIsoDate: string, endIsoDate: string) {
  const start = parseISO(startIsoDate);
  const end = parseISO(endIsoDate);
  let count = 0;
  const date = new Date(start);

  while (date <= end) {
    const day = date.getDay();
    if (day !== 0 && day !== 6) {
      count += 1;
    }
    date.setDate(date.getDate() + 1);
  }

  return count;
}

function makeSummary(staff: StaffMember[], requests: HolidayRequest[]): TeamHolidaySummary {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth(), getDaysInMonth(now));

  const staffOnLeaveToday = requests.filter(
    (request) =>
      request.status === "approved" &&
      today >= request.startsOn &&
      today <= request.endsOn
  ).length;

  const approvedThisMonth = requests.filter(
    (request) =>
      request.status === "approved" &&
      request.reviewedAt &&
      isWithinInterval(parseISO(request.reviewedAt), { start: firstDay, end: lastDay })
  ).length;

  const remainingAllowanceTotal = staff.reduce(
    (total, staffMember) => total + staffMember.remainingHoliday,
    0
  );

  const pendingRequests = requests.filter((request) => request.status === "pending").length;

  return {
    staffOnLeaveToday,
    pendingRequests,
    approvedThisMonth,
    remainingAllowanceTotal
  };
}

async function fetchSupabaseHolidayData() {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return null;
  }

  const [staffResult, requestsResult, adjustmentsResult] = await Promise.all([
    admin
      .from("staff_members")
      .select(
        "id,full_name,email,role_title,created_at,updated_at,holiday_balances(annual_allowance,used_holiday,remaining_holiday,credited_holiday,removed_holiday,manual_adjustments,pending_requests,approved_requests,rejected_requests)"
      )
      .order("full_name"),
    admin
      .from("holiday_requests")
      .select("id,staff_member_id,starts_on,ends_on,days_requested,reason,status,requested_at,reviewed_at,reviewed_by")
      .order("requested_at", { ascending: false }),
    admin
      .from("holiday_adjustments")
      .select("id,staff_member_id,adjustment_type,amount_days,reason,created_by,created_at")
      .order("created_at", { ascending: false })
  ]);

  if (staffResult.error) {
    throw new Error(`Failed to fetch staff members: ${staffResult.error.message}`);
  }

  if (requestsResult.error) {
    throw new Error(`Failed to fetch holiday requests: ${requestsResult.error.message}`);
  }

  if (adjustmentsResult.error) {
    throw new Error(`Failed to fetch holiday adjustments: ${adjustmentsResult.error.message}`);
  }

  const staff = (staffResult.data ?? []).map(mapStaffRow);
  const requests = (requestsResult.data ?? []).map(mapRequestRow);
  const adjustments = (adjustmentsResult.data ?? []).map(mapAdjustmentRow);

  return {
    staff,
    requests,
    adjustments,
    summary: makeSummary(staff, requests)
  };
}

export const holidayService = {
  async getDashboardData() {
    const supabaseData = await fetchSupabaseHolidayData();
    if (supabaseData) {
      return supabaseData;
    }

    return {
      staff: inMemoryStaff,
      requests: inMemoryRequests,
      adjustments: inMemoryAdjustments,
      summary: makeSummary(inMemoryStaff, inMemoryRequests)
    };
  },

  async getTeamHolidayCalendarEvents() {
    const { requests, staff } = await this.getDashboardData();

    return requests
      .filter((request) => request.status === "approved")
      .map((request) => {
        const member = staff.find((person) => person.id === request.staffMemberId);
        return {
          id: request.id,
          title: member ? `${member.fullName} Leave` : "Leave",
          start: request.startsOn,
          end: addDays(parseISO(request.endsOn), 1).toISOString().slice(0, 10),
          allDay: true
        };
      });
  },

  async createHolidayRequest(input: HolidayRequestInput) {
    const daysRequested = calculateBusinessDays(input.startsOn, input.endsOn);
    const nowIso = formatISO(new Date());
    const admin = createSupabaseAdminClient();

    if (admin) {
      const { data, error } = await admin
        .from("holiday_requests")
        .insert({
          staff_member_id: input.staffMemberId,
          starts_on: input.startsOn,
          ends_on: input.endsOn,
          days_requested: daysRequested,
          reason: input.reason ?? null,
          status: "pending",
          requested_at: nowIso
        })
        .select("id,staff_member_id,starts_on,ends_on,days_requested,reason,status,requested_at,reviewed_at,reviewed_by")
        .single();

      if (error) {
        throw new Error(`Failed to create request: ${error.message}`);
      }

      const { data: balanceRow } = await admin
        .from("holiday_balances")
        .select("pending_requests")
        .eq("staff_member_id", input.staffMemberId)
        .single();

      await admin
        .from("holiday_balances")
        .update({ pending_requests: (balanceRow?.pending_requests ?? 0) + 1 })
        .eq("staff_member_id", input.staffMemberId);

      return mapRequestRow(data);
    }

    const request: HolidayRequest = {
      id: `req_${Math.random().toString(36).slice(2, 9)}`,
      staffMemberId: input.staffMemberId,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      daysRequested,
      reason: input.reason ?? null,
      status: "pending",
      requestedAt: nowIso,
      reviewedAt: null,
      reviewedBy: null
    };

    inMemoryRequests = [request, ...inMemoryRequests];
    inMemoryStaff = inMemoryStaff.map((staff) =>
      staff.id === input.staffMemberId
        ? { ...staff, pendingRequests: staff.pendingRequests + 1, updatedAt: nowIso }
        : staff
    );

    return request;
  },

  async reviewHolidayRequest(requestId: string, status: HolidayRequestStatus, reviewer: string) {
    if (status === "pending") {
      throw new Error("Review status must be approved or rejected.");
    }

    const nowIso = formatISO(new Date());
    const admin = createSupabaseAdminClient();

    if (admin) {
      const { data: requestRow, error: requestError } = await admin
        .from("holiday_requests")
        .select("id,staff_member_id,days_requested,status")
        .eq("id", requestId)
        .single();

      if (requestError) {
        throw new Error(`Failed to fetch request: ${requestError.message}`);
      }

      const { error: updateRequestError } = await admin
        .from("holiday_requests")
        .update({ status, reviewed_at: nowIso, reviewed_by: reviewer })
        .eq("id", requestId);

      if (updateRequestError) {
        throw new Error(`Failed to review request: ${updateRequestError.message}`);
      }

      const { data: balanceRow, error: balanceError } = await admin
        .from("holiday_balances")
        .select(
          "annual_allowance,used_holiday,remaining_holiday,credited_holiday,removed_holiday,manual_adjustments,pending_requests,approved_requests,rejected_requests"
        )
        .eq("staff_member_id", requestRow.staff_member_id)
        .single();

      if (balanceError) {
        throw new Error(`Failed to fetch balance: ${balanceError.message}`);
      }

      const updatedBalance: Record<string, number> = {
        pending_requests: Math.max((balanceRow.pending_requests ?? 1) - 1, 0),
        approved_requests: balanceRow.approved_requests ?? 0,
        rejected_requests: balanceRow.rejected_requests ?? 0,
        manual_adjustments: balanceRow.manual_adjustments ?? 0,
        used_holiday: balanceRow.used_holiday ?? 0,
        remaining_holiday: balanceRow.remaining_holiday ?? 0
      };

      if (status === "approved") {
        updatedBalance.approved_requests += 1;
        updatedBalance.used_holiday += requestRow.days_requested;
        updatedBalance.remaining_holiday = Math.max(
          updatedBalance.remaining_holiday - requestRow.days_requested,
          0
        );
      }

      if (status === "rejected") {
        updatedBalance.rejected_requests += 1;
      }

      const { error: updateBalanceError } = await admin
        .from("holiday_balances")
        .update(updatedBalance)
        .eq("staff_member_id", requestRow.staff_member_id);

      if (updateBalanceError) {
        throw new Error(`Failed to update holiday balance: ${updateBalanceError.message}`);
      }

      return;
    }

    const request = inMemoryRequests.find((item) => item.id === requestId);
    if (!request) {
      throw new Error("Request not found.");
    }

    inMemoryRequests = inMemoryRequests.map((item) =>
      item.id === requestId ? { ...item, status, reviewedAt: nowIso, reviewedBy: reviewer } : item
    );

    inMemoryStaff = inMemoryStaff.map((staff) => {
      if (staff.id !== request.staffMemberId) {
        return staff;
      }

      const pendingRequests = Math.max(staff.pendingRequests - 1, 0);
      if (status === "approved") {
        const usedHoliday = staff.usedHoliday + request.daysRequested;
        return {
          ...staff,
          pendingRequests,
          approvedRequests: staff.approvedRequests + 1,
          usedHoliday,
          remainingHoliday: Math.max(
            staff.annualAllowance +
              staff.creditedHoliday +
              staff.manualAdjustments -
              staff.removedHoliday -
              usedHoliday,
            0
          ),
          updatedAt: nowIso
        };
      }

      return {
        ...staff,
        pendingRequests,
        rejectedRequests: staff.rejectedRequests + 1,
        updatedAt: nowIso
      };
    });
  },

  async applyAdjustment(input: HolidayAdjustmentInput, actor: string) {
    const nowIso = formatISO(new Date());
    const admin = createSupabaseAdminClient();

    if (admin) {
      const { data: inserted, error: insertError } = await admin
        .from("holiday_adjustments")
        .insert({
          staff_member_id: input.staffMemberId,
          adjustment_type: input.adjustmentType,
          amount_days: input.amountDays,
          reason: input.reason,
          created_by: actor,
          created_at: nowIso
        })
        .select("id,staff_member_id,adjustment_type,amount_days,reason,created_by,created_at")
        .single();

      if (insertError) {
        throw new Error(`Failed to apply adjustment: ${insertError.message}`);
      }

      const { data: balanceRow, error: balanceError } = await admin
        .from("holiday_balances")
        .select(
          "annual_allowance,used_holiday,remaining_holiday,credited_holiday,removed_holiday,manual_adjustments,pending_requests,approved_requests,rejected_requests"
        )
        .eq("staff_member_id", input.staffMemberId)
        .single();

      if (balanceError) {
        throw new Error(`Failed to fetch balance: ${balanceError.message}`);
      }

      const updatedBalance: Record<string, number> = {
        annual_allowance: balanceRow.annual_allowance ?? 0,
        used_holiday: balanceRow.used_holiday ?? 0,
        remaining_holiday: balanceRow.remaining_holiday ?? 0,
        credited_holiday: balanceRow.credited_holiday ?? 0,
        removed_holiday: balanceRow.removed_holiday ?? 0,
        manual_adjustments: balanceRow.manual_adjustments ?? 0,
        pending_requests: balanceRow.pending_requests ?? 0,
        approved_requests: balanceRow.approved_requests ?? 0,
        rejected_requests: balanceRow.rejected_requests ?? 0
      };

      if (input.adjustmentType === "credit") {
        updatedBalance.credited_holiday += input.amountDays;
        updatedBalance.remaining_holiday += input.amountDays;
      }

      if (input.adjustmentType === "remove") {
        updatedBalance.removed_holiday += input.amountDays;
        updatedBalance.remaining_holiday = Math.max(updatedBalance.remaining_holiday - input.amountDays, 0);
      }

      if (input.adjustmentType === "manual") {
        updatedBalance.manual_adjustments += input.amountDays;
        updatedBalance.remaining_holiday = Math.max(updatedBalance.remaining_holiday + input.amountDays, 0);
      }

      const { error: updateError } = await admin
        .from("holiday_balances")
        .update(updatedBalance)
        .eq("staff_member_id", input.staffMemberId);

      if (updateError) {
        throw new Error(`Failed to update balance: ${updateError.message}`);
      }

      return mapAdjustmentRow(inserted);
    }

    const adjustment: HolidayAdjustment = {
      id: `adj_${Math.random().toString(36).slice(2, 9)}`,
      staffMemberId: input.staffMemberId,
      adjustmentType: input.adjustmentType,
      amountDays: input.amountDays,
      reason: input.reason,
      createdBy: actor,
      createdAt: nowIso
    };

    inMemoryAdjustments = [adjustment, ...inMemoryAdjustments];

    inMemoryStaff = inMemoryStaff.map((staff) => {
      if (staff.id !== input.staffMemberId) {
        return staff;
      }

      const updated = { ...staff, updatedAt: nowIso };

      if (input.adjustmentType === "credit") {
        updated.creditedHoliday += input.amountDays;
        updated.remainingHoliday += input.amountDays;
      }

      if (input.adjustmentType === "remove") {
        updated.removedHoliday += input.amountDays;
        updated.remainingHoliday = Math.max(updated.remainingHoliday - input.amountDays, 0);
      }

      if (input.adjustmentType === "manual") {
        updated.manualAdjustments += input.amountDays;
        updated.remainingHoliday = Math.max(updated.remainingHoliday + input.amountDays, 0);
      }

      return updated;
    });

    return adjustment;
  }
};
