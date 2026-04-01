export type HolidayRequestStatus = "pending" | "approved" | "rejected";

export interface StaffMember {
  id: string;
  fullName: string;
  email: string;
  roleTitle: string;
  annualAllowance: number;
  usedHoliday: number;
  remainingHoliday: number;
  creditedHoliday: number;
  removedHoliday: number;
  manualAdjustments: number;
  pendingRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
  createdAt: string;
  updatedAt: string;
}

export interface HolidayRequest {
  id: string;
  staffMemberId: string;
  startsOn: string;
  endsOn: string;
  daysRequested: number;
  reason: string | null;
  status: HolidayRequestStatus;
  requestedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

export interface HolidayAdjustment {
  id: string;
  staffMemberId: string;
  adjustmentType: "credit" | "remove" | "manual";
  amountDays: number;
  reason: string;
  createdBy: string;
  createdAt: string;
}

export interface TeamHolidaySummary {
  staffOnLeaveToday: number;
  pendingRequests: number;
  approvedThisMonth: number;
  remainingAllowanceTotal: number;
}

export interface HolidayRequestInput {
  staffMemberId: string;
  startsOn: string;
  endsOn: string;
  reason?: string;
}

export interface HolidayAdjustmentInput {
  staffMemberId: string;
  adjustmentType: "credit" | "remove" | "manual";
  amountDays: number;
  reason: string;
}
