import "server-only";

import { formatISO, isAfter, isBefore, parseISO } from "date-fns";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { seededCalendarEvents } from "@/server/data/calendar";
import type { CalendarEvent, CalendarEventInput, CalendarFilters } from "@/types/calendar";

let inMemoryCalendarEvents: CalendarEvent[] = structuredClone(seededCalendarEvents);

function displayNameFromEmail(email: string) {
  return email.split("@")[0].replace(/[._-]/g, " ");
}

function mapEventRow(row: any): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    meetingLink: row.meeting_link,
    internalNotes: row.internal_notes,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    attendees: (row.calendar_event_attendees ?? []).map((attendee: any) => ({
      id: attendee.id,
      eventId: attendee.event_id,
      email: attendee.email,
      displayName: attendee.display_name,
      createdAt: attendee.created_at
    }))
  };
}

function filterByDateRange(events: CalendarEvent[], start?: string, end?: string) {
  return events.filter((event) => {
    if (!start && !end) {
      return true;
    }

    const eventStart = parseISO(event.startsAt);

    if (start && isBefore(eventStart, parseISO(start))) {
      return false;
    }

    if (end && isAfter(eventStart, parseISO(end))) {
      return false;
    }

    return true;
  });
}

function filterByStatuses(events: CalendarEvent[], filters?: CalendarFilters) {
  if (!filters?.statuses.length) {
    return events;
  }

  return events.filter((event) => filters.statuses.includes(event.status));
}

async function fetchSupabaseEvents(start?: string, end?: string, filters?: CalendarFilters) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return null;
  }

  let query = admin
    .from("calendar_events")
    .select(
      "id,title,description,location,meeting_link,internal_notes,status,starts_at,ends_at,created_by,created_at,updated_at,calendar_event_attendees(id,event_id,email,display_name,created_at)"
    )
    .order("starts_at", { ascending: true });

  if (start) {
    query = query.gte("starts_at", start);
  }

  if (end) {
    query = query.lte("starts_at", end);
  }

  if (filters?.statuses.length) {
    query = query.in("status", filters.statuses);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch calendar events: ${error.message}`);
  }

  return (data ?? []).map(mapEventRow);
}

export const calendarService = {
  async listEvents({ start, end, filters }: { start?: string; end?: string; filters?: CalendarFilters } = {}) {
    const supabaseEvents = await fetchSupabaseEvents(start, end, filters);
    if (supabaseEvents) {
      return supabaseEvents;
    }

    const filteredByDate = filterByDateRange(inMemoryCalendarEvents, start, end);
    return filterByStatuses(filteredByDate, filters).sort((a, b) =>
      parseISO(a.startsAt).getTime() - parseISO(b.startsAt).getTime()
    );
  },

  async getEventById(eventId: string) {
    const admin = createSupabaseAdminClient();

    if (admin) {
      const { data, error } = await admin
        .from("calendar_events")
        .select(
          "id,title,description,location,meeting_link,internal_notes,status,starts_at,ends_at,created_by,created_at,updated_at,calendar_event_attendees(id,event_id,email,display_name,created_at)"
        )
        .eq("id", eventId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch event: ${error.message}`);
      }

      return mapEventRow(data);
    }

    return inMemoryCalendarEvents.find((event) => event.id === eventId) ?? null;
  },

  async getUpcomingMeetings(limit = 5) {
    const events = await this.listEvents();
    const now = new Date();
    return events.filter((event) => parseISO(event.endsAt) > now).slice(0, limit);
  },

  async createEvent(input: CalendarEventInput, actorId: string) {
    const admin = createSupabaseAdminClient();

    if (admin) {
      const { data: eventRow, error: eventError } = await admin
        .from("calendar_events")
        .insert({
          title: input.title,
          description: input.description ?? null,
          location: input.location ?? null,
          meeting_link: input.meetingLink ?? null,
          internal_notes: input.internalNotes ?? null,
          status: input.status,
          starts_at: input.startsAt,
          ends_at: input.endsAt,
          created_by: actorId
        })
        .select("id")
        .single();

      if (eventError) {
        throw new Error(`Failed to create event: ${eventError.message}`);
      }

      if (input.attendeeEmails.length) {
        const attendeeRows = input.attendeeEmails.map((email) => ({
          event_id: eventRow.id,
          email,
          display_name: displayNameFromEmail(email)
        }));

        const { error: attendeeError } = await admin
          .from("calendar_event_attendees")
          .insert(attendeeRows);

        if (attendeeError) {
          throw new Error(`Failed to create attendees: ${attendeeError.message}`);
        }
      }

      const fullEvent = await this.getEventById(eventRow.id);
      if (!fullEvent) {
        throw new Error("Created event could not be fetched.");
      }

      return fullEvent;
    }

    const id = `evt_${Math.random().toString(36).slice(2, 9)}`;
    const now = formatISO(new Date());

    const created: CalendarEvent = {
      id,
      title: input.title,
      description: input.description ?? null,
      location: input.location ?? null,
      meetingLink: input.meetingLink ?? null,
      internalNotes: input.internalNotes ?? null,
      status: input.status,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      createdBy: actorId,
      createdAt: now,
      updatedAt: now,
      attendees: input.attendeeEmails.map((email) => ({
        id: `att_${Math.random().toString(36).slice(2, 9)}`,
        eventId: id,
        email,
        displayName: displayNameFromEmail(email),
        createdAt: now
      }))
    };

    inMemoryCalendarEvents = [...inMemoryCalendarEvents, created].sort(
      (a, b) => parseISO(a.startsAt).getTime() - parseISO(b.startsAt).getTime()
    );

    return created;
  },

  async updateEvent(eventId: string, input: CalendarEventInput) {
    const admin = createSupabaseAdminClient();

    if (admin) {
      const { error: updateError } = await admin
        .from("calendar_events")
        .update({
          title: input.title,
          description: input.description ?? null,
          location: input.location ?? null,
          meeting_link: input.meetingLink ?? null,
          internal_notes: input.internalNotes ?? null,
          status: input.status,
          starts_at: input.startsAt,
          ends_at: input.endsAt,
          updated_at: formatISO(new Date())
        })
        .eq("id", eventId);

      if (updateError) {
        throw new Error(`Failed to update event: ${updateError.message}`);
      }

      const { error: deleteAttendeesError } = await admin
        .from("calendar_event_attendees")
        .delete()
        .eq("event_id", eventId);

      if (deleteAttendeesError) {
        throw new Error(`Failed clearing attendees: ${deleteAttendeesError.message}`);
      }

      if (input.attendeeEmails.length) {
        const { error: insertAttendeesError } = await admin
          .from("calendar_event_attendees")
          .insert(
            input.attendeeEmails.map((email) => ({
              event_id: eventId,
              email,
              display_name: displayNameFromEmail(email)
            }))
          );

        if (insertAttendeesError) {
          throw new Error(`Failed recreating attendees: ${insertAttendeesError.message}`);
        }
      }

      const updatedEvent = await this.getEventById(eventId);
      if (!updatedEvent) {
        throw new Error("Updated event could not be fetched.");
      }

      return updatedEvent;
    }

    inMemoryCalendarEvents = inMemoryCalendarEvents.map((event) =>
      event.id === eventId
        ? {
            ...event,
            title: input.title,
            description: input.description ?? null,
            location: input.location ?? null,
            meetingLink: input.meetingLink ?? null,
            internalNotes: input.internalNotes ?? null,
            status: input.status,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
            updatedAt: formatISO(new Date()),
            attendees: input.attendeeEmails.map((email) => ({
              id: `att_${Math.random().toString(36).slice(2, 9)}`,
              eventId,
              email,
              displayName: displayNameFromEmail(email),
              createdAt: formatISO(new Date())
            }))
          }
        : event
    );

    const updated = inMemoryCalendarEvents.find((event) => event.id === eventId);
    if (!updated) {
      throw new Error("Event not found.");
    }

    return updated;
  },

  async updateEventTimes(eventId: string, startsAt: string, endsAt: string) {
    const event = await this.getEventById(eventId);
    if (!event) {
      throw new Error("Event not found.");
    }

    return this.updateEvent(eventId, {
      title: event.title,
      description: event.description ?? undefined,
      location: event.location ?? undefined,
      meetingLink: event.meetingLink ?? undefined,
      internalNotes: event.internalNotes ?? undefined,
      status: event.status,
      startsAt,
      endsAt,
      attendeeEmails: event.attendees.map((attendee) => attendee.email)
    });
  },

  async deleteEvent(eventId: string) {
    const admin = createSupabaseAdminClient();

    if (admin) {
      const { error } = await admin.from("calendar_events").delete().eq("id", eventId);
      if (error) {
        throw new Error(`Failed to delete event: ${error.message}`);
      }
      return;
    }

    inMemoryCalendarEvents = inMemoryCalendarEvents.filter((event) => event.id !== eventId);
  }
};
