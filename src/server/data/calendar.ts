import type { CalendarEvent } from "@/types/calendar";

export const seededCalendarEvents: CalendarEvent[] = [
  {
    id: "evt_1",
    title: "Weekly Performance Sync",
    description: "Review core channels and pacing against plan.",
    location: "HQ Boardroom",
    meetingLink: "https://meet.google.com/mock-sync",
    internalNotes: "Bring prior-week anomalies and action log.",
    status: "confirmed",
    startsAt: "2026-04-02T09:00:00.000Z",
    endsAt: "2026-04-02T10:00:00.000Z",
    createdBy: "admin",
    createdAt: "2026-03-28T09:00:00.000Z",
    updatedAt: "2026-03-28T09:00:00.000Z",
    attendees: [
      {
        id: "att_1",
        eventId: "evt_1",
        email: "ops@thesnuslife.com",
        displayName: "Ops Team",
        createdAt: "2026-03-28T09:00:00.000Z"
      },
      {
        id: "att_2",
        eventId: "evt_1",
        email: "marketing@thesnuslife.com",
        displayName: "Marketing Team",
        createdAt: "2026-03-28T09:00:00.000Z"
      }
    ]
  },
  {
    id: "evt_2",
    title: "Agency Creative Review",
    description: "Approve new ad concepts and rollout windows.",
    location: "Zoom",
    meetingLink: "https://zoom.us/mock-creative",
    internalNotes: null,
    status: "planned",
    startsAt: "2026-04-03T13:00:00.000Z",
    endsAt: "2026-04-03T14:00:00.000Z",
    createdBy: "admin",
    createdAt: "2026-03-29T09:00:00.000Z",
    updatedAt: "2026-03-29T09:00:00.000Z",
    attendees: [
      {
        id: "att_3",
        eventId: "evt_2",
        email: "ceo@thesnuslife.com",
        displayName: "CEO",
        createdAt: "2026-03-29T09:00:00.000Z"
      }
    ]
  },
  {
    id: "evt_3",
    title: "Unleashed Margin Workshop",
    description: "Validate margin movement by channel.",
    location: "War Room",
    meetingLink: null,
    internalNotes: "Focus on wholesale margin erosion.",
    status: "planned",
    startsAt: "2026-04-06T11:30:00.000Z",
    endsAt: "2026-04-06T12:30:00.000Z",
    createdBy: "admin",
    createdAt: "2026-03-27T09:00:00.000Z",
    updatedAt: "2026-03-27T09:00:00.000Z",
    attendees: []
  }
];
