export type MeetingStatus = "planned" | "confirmed" | "done" | "cancelled";

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
  location: string | null;
  meetingLink: string | null;
  internalNotes: string | null;
  status: MeetingStatus;
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
  location?: string;
  meetingLink?: string;
  internalNotes?: string;
  status: MeetingStatus;
  startsAt: string;
  endsAt: string;
  attendeeEmails: string[];
}

export interface CalendarFilters {
  statuses: MeetingStatus[];
}
