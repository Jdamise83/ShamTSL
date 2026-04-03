export type MeetingStatus = "planned" | "confirmed" | "done" | "cancelled";
export type CalendarEventType = "meeting" | "event" | "task";

export interface CalendarAttendee {
  id: string;
  eventId: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  eventType: CalendarEventType;
  title: string;
  description: string | null;
  location: string | null;
  meetingLink: string | null;
  internalNotes: string | null;
  status: MeetingStatus;
  allDay: boolean;
  startsAt: string;
  endsAt: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  attendees: CalendarAttendee[];
}

export interface CalendarEventInput {
  eventType?: CalendarEventType;
  title: string;
  description?: string;
  location?: string;
  meetingLink?: string;
  internalNotes?: string;
  status: MeetingStatus;
  allDay?: boolean;
  startsAt: string;
  endsAt: string;
  attendeeEmails: string[];
}

export interface CalendarFilters {
  statuses: MeetingStatus[];
  eventTypes?: CalendarEventType[];
}
