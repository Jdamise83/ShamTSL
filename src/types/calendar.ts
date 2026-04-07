export type MeetingStatus = "planned" | "confirmed" | "done" | "cancelled";
export type CalendarItemType = "meeting" | "event" | "task";
export type CalendarScope = "main" | "personal" | "brand-campaign";
export type PersonalCalendarOwner = "dylan" | "john";
export type BrandCampaignType = "brand" | "campaign";

export interface CalendarAttendee {
  id: string;
  eventId: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  location: string | null;
  meetingLink: string | null;
  internalNotes: string | null;
  status: MeetingStatus;
  eventType: CalendarItemType;
  allDay: boolean;
  calendarScope: CalendarScope;
  personalOwner: PersonalCalendarOwner | null;
  brandCampaignType: BrandCampaignType | null;
  notifyBoth: boolean;
  startsAt: string;
  endsAt: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  attendees: CalendarAttendee[];
}

export interface CalendarEventInput {
  title: string;
  description?: string;
  imageUrl?: string;
  location?: string;
  meetingLink?: string;
  internalNotes?: string;
  status: MeetingStatus;
  eventType?: CalendarItemType;
  allDay?: boolean;
  calendarScope?: CalendarScope;
  personalOwner?: PersonalCalendarOwner | null;
  brandCampaignType?: BrandCampaignType | null;
  notifyBoth?: boolean;
  startsAt: string;
  endsAt: string;
  attendeeEmails: string[];
}

export interface CalendarFilters {
  statuses: MeetingStatus[];
}
