import type {
  HolidayAdjustment,
  HolidayRequest,
  StaffMember
} from "@/types/holiday";

export const seededStaffMembers: StaffMember[] = [
  {
    id: "staff_1",
    fullName: "Mia Andersson",
    email: "mia@thesnuslife.com",
    roleTitle: "Performance Lead",
    annualAllowance: 28,
    usedHoliday: 7,
    remainingHoliday: 21,
    creditedHoliday: 2,
    removedHoliday: 1,
    manualAdjustments: 0,
    pendingRequests: 1,
    approvedRequests: 3,
    rejectedRequests: 0,
    createdAt: "2026-01-02T08:00:00.000Z",
    updatedAt: "2026-03-31T08:00:00.000Z"
  },
  {
    id: "staff_2",
    fullName: "Leo Patel",
    email: "leo@thesnuslife.com",
    roleTitle: "SEO Manager",
    annualAllowance: 25,
    usedHoliday: 5,
    remainingHoliday: 20,
    creditedHoliday: 1,
    removedHoliday: 0,
    manualAdjustments: 1,
    pendingRequests: 0,
    approvedRequests: 2,
    rejectedRequests: 1,
    createdAt: "2026-01-05T08:00:00.000Z",
    updatedAt: "2026-03-31T08:00:00.000Z"
  },
  {
    id: "staff_3",
    fullName: "Ava Reynolds",
    email: "ava@thesnuslife.com",
    roleTitle: "Operations Coordinator",
    annualAllowance: 24,
    usedHoliday: 9,
    remainingHoliday: 15,
    creditedHoliday: 0,
    removedHoliday: 0,
    manualAdjustments: 0,
    pendingRequests: 2,
    approvedRequests: 4,
    rejectedRequests: 0,
    createdAt: "2026-01-12T08:00:00.000Z",
    updatedAt: "2026-03-31T08:00:00.000Z"
  }
];

export const seededHolidayRequests: HolidayRequest[] = [
  {
    id: "req_1",
    staffMemberId: "staff_1",
    startsOn: "2026-04-11",
    endsOn: "2026-04-14",
    daysRequested: 2,
    reason: "Family visit",
    status: "pending",
    requestedAt: "2026-03-29T10:00:00.000Z",
    reviewedAt: null,
    reviewedBy: null
  },
  {
    id: "req_2",
    staffMemberId: "staff_3",
    startsOn: "2026-04-02",
    endsOn: "2026-04-03",
    daysRequested: 2,
    reason: "Personal",
    status: "approved",
    requestedAt: "2026-03-20T10:00:00.000Z",
    reviewedAt: "2026-03-21T10:00:00.000Z",
    reviewedBy: "admin"
  },
  {
    id: "req_3",
    staffMemberId: "staff_2",
    startsOn: "2026-03-12",
    endsOn: "2026-03-12",
    daysRequested: 1,
    reason: "Appointment",
    status: "rejected",
    requestedAt: "2026-03-01T10:00:00.000Z",
    reviewedAt: "2026-03-02T10:00:00.000Z",
    reviewedBy: "admin"
  }
];

export const seededHolidayAdjustments: HolidayAdjustment[] = [
  {
    id: "adj_1",
    staffMemberId: "staff_1",
    adjustmentType: "credit",
    amountDays: 2,
    reason: "Year-end carryover",
    createdBy: "admin",
    createdAt: "2026-01-03T09:00:00.000Z"
  },
  {
    id: "adj_2",
    staffMemberId: "staff_1",
    adjustmentType: "remove",
    amountDays: 1,
    reason: "Policy correction",
    createdBy: "admin",
    createdAt: "2026-02-14T09:00:00.000Z"
  },
  {
    id: "adj_3",
    staffMemberId: "staff_2",
    adjustmentType: "manual",
    amountDays: 1,
    reason: "Comp day",
    createdBy: "admin",
    createdAt: "2026-03-09T09:00:00.000Z"
  }
];
