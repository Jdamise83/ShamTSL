"use client";

import { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";

import { CalendarShell } from "@/components/calendar/calendar-shell";
import { HolidayBalanceCard } from "@/components/holiday/holiday-balance-card";
import { StaffProfilePanel } from "@/components/holiday/staff-profile-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { HolidayAdjustment, HolidayRequest, StaffMember, TeamHolidaySummary } from "@/types/holiday";

interface HolidayCalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
}

interface HolidayDashboardPayload {
  staff: StaffMember[];
  requests: HolidayRequest[];
  adjustments: HolidayAdjustment[];
  summary: TeamHolidaySummary;
  calendarEvents: HolidayCalendarEvent[];
}

interface HolidayDashboardClientProps {
  initialPayload: HolidayDashboardPayload;
}

export function HolidayDashboardClient({ initialPayload }: HolidayDashboardClientProps) {
  const [payload, setPayload] = useState(initialPayload);
  const [selectedStaffId, setSelectedStaffId] = useState(initialPayload.staff[0]?.id ?? "");
  const [requestStaffId, setRequestStaffId] = useState(initialPayload.staff[0]?.id ?? "");
  const [requestStart, setRequestStart] = useState("");
  const [requestEnd, setRequestEnd] = useState("");
  const [requestReason, setRequestReason] = useState("");
  const [adjustStaffId, setAdjustStaffId] = useState(initialPayload.staff[0]?.id ?? "");
  const [adjustType, setAdjustType] = useState<"credit" | "remove" | "manual">("credit");
  const [adjustDays, setAdjustDays] = useState("1");
  const [adjustReason, setAdjustReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedStaff = useMemo(
    () => payload.staff.find((staff) => staff.id === selectedStaffId) ?? null,
    [payload.staff, selectedStaffId]
  );

  const pendingRequests = useMemo(
    () => payload.requests.filter((request) => request.status === "pending"),
    [payload.requests]
  );

  async function postAction(body: object) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error("Holiday action failed.");
      }

      const nextPayload = (await response.json()) as HolidayDashboardPayload;
      setPayload(nextPayload);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unexpected holiday action error.");
    } finally {
      setLoading(false);
    }
  }

  async function submitHolidayRequest() {
    if (!requestStaffId || !requestStart || !requestEnd) {
      setError("Staff member, start date and end date are required for leave requests.");
      return;
    }

    await postAction({
      action: "request",
      payload: {
        staffMemberId: requestStaffId,
        startsOn: requestStart,
        endsOn: requestEnd,
        reason: requestReason
      }
    });

    setRequestReason("");
  }

  async function applyAdjustment() {
    const amountDays = Number(adjustDays);
    if (!adjustStaffId || Number.isNaN(amountDays) || amountDays <= 0 || !adjustReason.trim()) {
      setError("Provide staff member, positive day count and reason for adjustment.");
      return;
    }

    await postAction({
      action: "adjust",
      payload: {
        staffMemberId: adjustStaffId,
        adjustmentType: adjustType,
        amountDays,
        reason: adjustReason
      }
    });

    setAdjustReason("");
  }

  async function reviewRequest(requestId: string, status: "approved" | "rejected") {
    await postAction({
      action: "review",
      payload: {
        requestId,
        status
      }
    });
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border/80 bg-card">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Staff On Leave Today</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{payload.summary.staffOnLeaveToday}</p>
          </CardContent>
        </Card>
        <Card className="border-border/80 bg-card">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Pending Requests</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{payload.summary.pendingRequests}</p>
          </CardContent>
        </Card>
        <Card className="border-border/80 bg-card">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Approved This Month</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{payload.summary.approvedThisMonth}</p>
          </CardContent>
        </Card>
        <Card className="border-border/80 bg-card">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Remaining Allowance</p>
            <p className="mt-2 text-3xl font-semibold text-primary">{payload.summary.remainingAllowanceTotal}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.7fr_0.8fr]">
        <CalendarShell title="Team Holiday Calendar" subtitle="Approved leave across the team.">
          <FullCalendar
            plugins={[dayGridPlugin]}
            initialView="dayGridMonth"
            height="auto"
            events={payload.calendarEvents}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth"
            }}
          />
        </CalendarShell>

        <StaffProfilePanel staff={selectedStaff} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card className="border-border/80 bg-card">
          <CardHeader>
            <CardTitle className="text-base uppercase tracking-[0.08em]">Staff Balances</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {payload.staff.map((staff) => (
                <button
                  key={staff.id}
                  type="button"
                  onClick={() => setSelectedStaffId(staff.id)}
                  className={staff.id === selectedStaffId ? "rounded-2xl ring-2 ring-primary" : "rounded-2xl"}
                >
                  <HolidayBalanceCard staff={staff} />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card">
          <CardHeader>
            <CardTitle className="text-base uppercase tracking-[0.08em]">Request Holiday</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Staff Member</Label>
              <Select value={requestStaffId} onValueChange={setRequestStaffId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff" />
                </SelectTrigger>
                <SelectContent>
                  {payload.staff.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {staff.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input type="date" value={requestStart} onChange={(event) => setRequestStart(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>End Date</Label>
                <Input type="date" value={requestEnd} onChange={(event) => setRequestEnd(event.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Textarea
                value={requestReason}
                onChange={(event) => setRequestReason(event.target.value)}
                placeholder="Optional reason"
              />
            </div>
            <Button onClick={submitHolidayRequest} disabled={loading}>
              {loading ? "Submitting..." : "Submit Request"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="border-border/80 bg-card">
          <CardHeader>
            <CardTitle className="text-base uppercase tracking-[0.08em]">Pending Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            {pendingRequests.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingRequests.map((request) => {
                    const staff = payload.staff.find((member) => member.id === request.staffMemberId);
                    return (
                      <TableRow key={request.id}>
                        <TableCell>{staff?.fullName ?? request.staffMemberId}</TableCell>
                        <TableCell>
                          {request.startsOn} to {request.endsOn}
                        </TableCell>
                        <TableCell>{request.daysRequested}</TableCell>
                        <TableCell className="space-x-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => reviewRequest(request.id, "approved")}
                            disabled={loading}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => reviewRequest(request.id, "rejected")}
                            disabled={loading}
                          >
                            Reject
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No pending requests.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card">
          <CardHeader>
            <CardTitle className="text-base uppercase tracking-[0.08em]">Manual Adjustments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Staff Member</Label>
              <Select value={adjustStaffId} onValueChange={setAdjustStaffId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff" />
                </SelectTrigger>
                <SelectContent>
                  {payload.staff.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {staff.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Adjustment Type</Label>
                <Select
                  value={adjustType}
                  onValueChange={(value) => setAdjustType(value as "credit" | "remove" | "manual")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">Credit</SelectItem>
                    <SelectItem value="remove">Remove</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Days</Label>
                <Input value={adjustDays} onChange={(event) => setAdjustDays(event.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Textarea
                value={adjustReason}
                onChange={(event) => setAdjustReason(event.target.value)}
                placeholder="Explain this adjustment"
              />
            </div>
            <Button onClick={applyAdjustment} disabled={loading}>
              {loading ? "Applying..." : "Apply Adjustment"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 bg-card">
        <CardHeader>
          <CardTitle className="text-base uppercase tracking-[0.08em]">Adjustment Audit Log</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payload.adjustments.map((adjustment) => {
                const staff = payload.staff.find((member) => member.id === adjustment.staffMemberId);
                return (
                  <TableRow key={adjustment.id}>
                    <TableCell>{staff?.fullName ?? adjustment.staffMemberId}</TableCell>
                    <TableCell>{adjustment.adjustmentType}</TableCell>
                    <TableCell>{adjustment.amountDays}</TableCell>
                    <TableCell>{adjustment.reason}</TableCell>
                    <TableCell>{new Date(adjustment.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
