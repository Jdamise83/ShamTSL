import "server-only";

import { formatISO, isAfter, isBefore, parseISO } from "date-fns";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { provisionalTradeShowEvents, seededCalendarEvents } from "@/server/data/calendar";
import type {
  BrandCampaignType,
  CalendarScope,
  CalendarEvent,
  CalendarEventInput,
  CalendarFilters,
  CalendarItemType,
  PersonalCalendarOwner
} from "@/types/calendar";

let inMemoryCalendarEvents: CalendarEvent[] = structuredClone(seededCalendarEvents);
const metadataPrefix = "[[TSL_META]]";
const calendarScopes: CalendarScope[] = ["main", "personal", "brand-campaign"];
const personalOwners: PersonalCalendarOwner[] = ["dylan", "john"];
const brandCampaignTypes: BrandCampaignType[] = ["brand", "campaign"];

function displayNameFromEmail(email: string) {
  return email.split("@")[0].replace(/[._-]/g, " ");
}

function isCalendarScope(value: unknown): value is CalendarScope {
  return typeof value === "string" && calendarScopes.includes(value as CalendarScope);
}

function isPersonalOwner(value: unknown): value is PersonalCalendarOwner {
  return typeof value === "string" && personalOwners.includes(value as PersonalCalendarOwner);
}

function isBrandCampaignType(value: unknown): value is BrandCampaignType {
  return typeof value === "string" && brandCampaignTypes.includes(value as BrandCampaignType);
}

function parseInternalNotesMetadata(rawInternalNotes: string | null | undefined) {
  const fallback = {
    eventType: "meeting" as CalendarItemType,
    allDay: false,
    notes: null as string | null,
    imageUrl: null as string | null,
    calendarScope: "main" as CalendarScope,
    personalOwner: null as PersonalCalendarOwner | null,
    brandCampaignType: null as BrandCampaignType | null,
    notifyBoth: false
  };

  if (!rawInternalNotes) {
    return fallback;
  }

  if (!rawInternalNotes.startsWith(metadataPrefix)) {
    return { ...fallback, notes: rawInternalNotes };
  }

  const [metadataLine = "", ...notesLines] = rawInternalNotes.split("\n");
  const metadataRaw = metadataLine.replace(metadataPrefix, "").trim();

  try {
    const parsed = JSON.parse(metadataRaw) as {
      eventType?: CalendarItemType;
      allDay?: boolean;
      imageUrl?: string | null;
      calendarScope?: CalendarScope;
      personalOwner?: PersonalCalendarOwner | null;
      brandCampaignType?: BrandCampaignType | null;
      notifyBoth?: boolean;
    };
    const eventType: CalendarItemType =
      parsed.eventType === "event" || parsed.eventType === "task" ? parsed.eventType : "meeting";
    const personalOwner = isPersonalOwner(parsed.personalOwner) ? parsed.personalOwner : null;
    const brandCampaignType = isBrandCampaignType(parsed.brandCampaignType) ? parsed.brandCampaignType : null;
    const inferredScope: CalendarScope = brandCampaignType
      ? "brand-campaign"
      : personalOwner
        ? "personal"
        : "main";
    const calendarScope = isCalendarScope(parsed.calendarScope) ? parsed.calendarScope : inferredScope;
    const imageUrl = typeof parsed.imageUrl === "string" && parsed.imageUrl.trim() ? parsed.imageUrl.trim() : null;
    const notes = notesLines.join("\n").trim() || null;

    return {
      eventType,
      allDay: parsed.allDay === true,
      notes,
      imageUrl,
      calendarScope,
      personalOwner,
      brandCampaignType,
      notifyBoth: parsed.notifyBoth === true
    };
  } catch {
    return { ...fallback, notes: rawInternalNotes };
  }
}

function buildInternalNotesPayload(
  rawNotes: string | undefined,
  eventType: CalendarItemType,
  allDay: boolean,
  imageUrl: string | null,
  calendarScope: CalendarScope,
  personalOwner: PersonalCalendarOwner | null,
  brandCampaignType: BrandCampaignType | null,
  notifyBoth: boolean
) {
  const notes = rawNotes?.trim() || "";
  const requiresMetadata =
    eventType !== "meeting" ||
    allDay ||
    imageUrl !== null ||
    calendarScope !== "main" ||
    personalOwner !== null ||
    brandCampaignType !== null ||
    notifyBoth;

  if (!requiresMetadata) {
    return notes || null;
  }

  const metadata = `${metadataPrefix}${JSON.stringify({
    eventType,
    allDay,
    imageUrl,
    calendarScope,
    personalOwner,
    brandCampaignType,
    notifyBoth
  })}`;
  return notes ? `${metadata}\n${notes}` : metadata;
}

function mapEventRow(row: any): CalendarEvent {
  const normalized = parseInternalNotesMetadata(row.internal_notes);

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    imageUrl: normalized.imageUrl,
    location: row.location,
    meetingLink: row.meeting_link,
    internalNotes: normalized.notes,
    status: row.status,
    eventType: normalized.eventType,
    allDay: normalized.allDay,
    calendarScope: normalized.calendarScope,
    personalOwner: normalized.personalOwner,
    brandCampaignType: normalized.brandCampaignType,
    notifyBoth: normalized.notifyBoth,
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

function eventFingerprint(event: CalendarEvent) {
  return `${event.title.toLowerCase()}|${event.startsAt}|${event.endsAt}`;
}

function mergeWithProvisionalTradeShows(events: CalendarEvent[]) {
  const existing = new Set(events.map(eventFingerprint));
  const merged = [...events];

  for (const tradeShow of provisionalTradeShowEvents) {
    const fingerprint = eventFingerprint(tradeShow);
    if (!existing.has(fingerprint)) {
      merged.push(tradeShow);
      existing.add(fingerprint);
    }
  }

  return merged;
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
      const merged = mergeWithProvisionalTradeShows(supabaseEvents);
      const filteredByDate = filterByDateRange(merged, start, end);
      return filterByStatuses(filteredByDate, filters).sort(
        (a, b) => parseISO(a.startsAt).getTime() - parseISO(b.startsAt).getTime()
      );
    }

    const merged = mergeWithProvisionalTradeShows(inMemoryCalendarEvents);
    const filteredByDate = filterByDateRange(merged, start, end);
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
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to fetch event: ${error.message}`);
      }

      if (data) {
        return mapEventRow(data);
      }

      return provisionalTradeShowEvents.find((event) => event.id === eventId) ?? null;
    }

    return (
      inMemoryCalendarEvents.find((event) => event.id === eventId) ??
      provisionalTradeShowEvents.find((event) => event.id === eventId) ??
      null
    );
  },

  async getUpcomingByType(eventType: CalendarItemType, limit = 3) {
    const events = await this.listEvents();
    const now = new Date();
    return events
      .filter((event) => event.eventType === eventType && parseISO(event.endsAt) > now)
      .sort((a, b) => parseISO(a.startsAt).getTime() - parseISO(b.startsAt).getTime())
      .slice(0, limit);
  },

  async getUpcomingMeetings(limit = 3) {
    return this.getUpcomingByType("meeting", limit);
  },

  async getUpcomingEvents(limit = 3) {
    return this.getUpcomingByType("event", limit);
  },

  async getUpcomingTasks(limit = 3) {
    return this.getUpcomingByType("task", limit);
  },

  async createEvent(input: CalendarEventInput, actorId: string) {
    const admin = createSupabaseAdminClient();
    const eventType = input.eventType ?? "meeting";
    const allDay = input.allDay === true || input.calendarScope === "brand-campaign";
    const calendarScope = input.calendarScope ?? "main";
    const personalOwner = input.personalOwner ?? null;
    const brandCampaignType = input.brandCampaignType ?? null;
    const notifyBoth = input.notifyBoth === true;
    const internalNotesPayload = buildInternalNotesPayload(
      input.internalNotes,
      eventType,
      allDay,
      input.imageUrl?.trim() ? input.imageUrl.trim() : null,
      calendarScope,
      personalOwner,
      brandCampaignType,
      notifyBoth
    );

    if (admin) {
      const { data: eventRow, error: eventError } = await admin
        .from("calendar_events")
        .insert({
          title: input.title,
          description: input.description ?? null,
          location: input.location ?? null,
          meeting_link: input.meetingLink ?? null,
          internal_notes: internalNotesPayload,
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
      imageUrl: input.imageUrl?.trim() ? input.imageUrl.trim() : null,
      location: input.location ?? null,
      meetingLink: input.meetingLink ?? null,
      internalNotes: input.internalNotes ?? null,
      status: input.status,
      eventType,
      allDay,
      calendarScope,
      personalOwner,
      brandCampaignType,
      notifyBoth,
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
    const eventType = input.eventType ?? "meeting";
    const allDay = input.allDay === true || input.calendarScope === "brand-campaign";
    const calendarScope = input.calendarScope ?? "main";
    const personalOwner = input.personalOwner ?? null;
    const brandCampaignType = input.brandCampaignType ?? null;
    const notifyBoth = input.notifyBoth === true;
    const internalNotesPayload = buildInternalNotesPayload(
      input.internalNotes,
      eventType,
      allDay,
      input.imageUrl?.trim() ? input.imageUrl.trim() : null,
      calendarScope,
      personalOwner,
      brandCampaignType,
      notifyBoth
    );

    if (admin) {
      const { error: updateError } = await admin
        .from("calendar_events")
        .update({
          title: input.title,
          description: input.description ?? null,
          location: input.location ?? null,
          meeting_link: input.meetingLink ?? null,
          internal_notes: internalNotesPayload,
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
            imageUrl: input.imageUrl?.trim() ? input.imageUrl.trim() : null,
            location: input.location ?? null,
            meetingLink: input.meetingLink ?? null,
            internalNotes: input.internalNotes ?? null,
            status: input.status,
            eventType: input.eventType ?? event.eventType ?? "meeting",
            allDay,
            calendarScope,
            personalOwner,
            brandCampaignType,
            notifyBoth,
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
      imageUrl: event.imageUrl ?? undefined,
      location: event.location ?? undefined,
      meetingLink: event.meetingLink ?? undefined,
      internalNotes: event.internalNotes ?? undefined,
      status: event.status,
      eventType: event.eventType,
      allDay: event.allDay,
      calendarScope: event.calendarScope,
      personalOwner: event.personalOwner,
      brandCampaignType: event.brandCampaignType,
      notifyBoth: event.notifyBoth,
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
