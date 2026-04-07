"use client";

import { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import type {
  EventContentArg,
  EventClickArg,
  EventDropArg,
  EventInput
} from "@fullcalendar/core";
import enGbLocale from "@fullcalendar/core/locales/en-gb";
import type { DateClickArg, EventResizeDoneArg } from "@fullcalendar/interaction";

import { CalendarShell } from "@/components/calendar/calendar-shell";
import { EmptyState } from "@/components/dashboard/empty-state";
import { RangeLabel } from "@/components/dashboard/range-label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  BrandCampaignType,
  CalendarEvent,
  CalendarItemType,
  CalendarScope,
  MeetingStatus,
  PersonalCalendarOwner
} from "@/types/calendar";

interface CalendarDashboardClientProps {
  initialEvents: CalendarEvent[];
  initialView?: CalendarScope;
}

type PersonalOwnerFilter = PersonalCalendarOwner | "all";

interface EventFormState {
  id: string | null;
  title: string;
  description: string;
  imageUrl: string;
  location: string;
  meetingLink: string;
  internalNotes: string;
  status: MeetingStatus;
  eventType: CalendarItemType;
  calendarScope: CalendarScope;
  personalOwner: PersonalCalendarOwner;
  brandCampaignType: BrandCampaignType;
  startsAt: string;
  endsAt: string;
  startDate: string;
  durationDays: string;
  attendeeEmails: string;
  includeBoth: boolean;
  notifyBoth: boolean;
}

const statusOptions: MeetingStatus[] = ["planned", "confirmed", "done", "cancelled"];
const eventTypeOptions: CalendarItemType[] = ["meeting", "event", "task"];
const statusLabelMap: Record<MeetingStatus, string> = {
  planned: "Provisional",
  confirmed: "Confirmed",
  done: "Done",
  cancelled: "Cancelled"
};

const statusColorMap: Record<MeetingStatus, string> = {
  planned: "#2f74ff",
  confirmed: "#0ea5a3",
  done: "#16915f",
  cancelled: "#d14343"
};

const personalDirectory: Record<
  PersonalCalendarOwner,
  {
    label: string;
    prefix: string;
    email: string;
    color: string;
  }
> = {
  dylan: {
    label: "Dylan",
    prefix: "DYLAN",
    email: "dylan@thesnuslife.com",
    color: "#3b82f6"
  },
  john: {
    label: "John",
    prefix: "JOHN",
    email: "john@thesnuslife.com",
    color: "#0ea5a3"
  }
};

const alignedPersonalColor = "#7c3aed";
const brandColor = "#bfdbfe";
const campaignColor = "#bbf7d0";
const taskColor = "#facc15";
const defaultEventColor = "#fca5a5";

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

function withOpacity(hex: string, opacity: number) {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) {
    return hex;
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, opacity))})`;
}

function getStatusLabel(status: MeetingStatus) {
  return statusLabelMap[status] ?? status;
}

function getDynamicEventTitleFontSize(title: string) {
  const length = title.trim().length;

  if (length <= 18) {
    return "1.05rem";
  }

  if (length <= 30) {
    return "0.95rem";
  }

  if (length <= 44) {
    return "0.85rem";
  }

  return "0.75rem";
}

function getCalendarEventTextLayout(argument: EventContentArg) {
  const isAllDay = argument.event.allDay;
  const titleLength = argument.event.title.trim().length;
  const start = argument.event.start;
  const end = argument.event.end;
  const durationMinutes =
    start && end ? Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000)) : 60;

  if (isAllDay) {
    return {
      timeFontSize: "0.65rem",
      titleFontSize: titleLength > 28 ? "0.72rem" : "0.76rem",
      titleClamp: 2
    };
  }

  if (durationMinutes <= 45) {
    return {
      timeFontSize: "0.62rem",
      titleFontSize: titleLength > 18 ? "0.68rem" : "0.72rem",
      titleClamp: 1
    };
  }

  if (durationMinutes <= 75) {
    return {
      timeFontSize: "0.64rem",
      titleFontSize: titleLength > 24 ? "0.7rem" : "0.74rem",
      titleClamp: 2
    };
  }

  if (durationMinutes <= 120) {
    return {
      timeFontSize: "0.68rem",
      titleFontSize: titleLength > 28 ? "0.74rem" : "0.78rem",
      titleClamp: 2
    };
  }

  return {
    timeFontSize: "0.7rem",
    titleFontSize: getDynamicEventTitleFontSize(argument.event.title),
    titleClamp: 3
  };
}

function toLocalInputValue(isoDate: string) {
  const date = new Date(isoDate);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

function fromLocalInputValue(localDateTime: string) {
  return new Date(localDateTime).toISOString();
}

function toLocalDateValue(isoDate: string) {
  return toLocalInputValue(isoDate).slice(0, 10);
}

function fromLocalDateValue(localDate: string) {
  return new Date(`${localDate}T00:00:00`).toISOString();
}

function uniqueEmails(values: string[]) {
  return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))];
}

function localPart(email: string) {
  return email.split("@")[0]?.toLowerCase() ?? "";
}

function includesOwner(event: CalendarEvent, owner: PersonalCalendarOwner) {
  if (event.personalOwner === owner) {
    return true;
  }

  return event.attendees.some((attendee) => localPart(attendee.email) === owner);
}

function hasBothOwners(event: CalendarEvent) {
  return includesOwner(event, "dylan") && includesOwner(event, "john");
}

function getOtherOwner(owner: PersonalCalendarOwner) {
  return owner === "dylan" ? "john" : "dylan";
}

function getPersonalPrefix(event: CalendarEvent) {
  if (hasBothOwners(event)) {
    return "DYLAN + JOHN";
  }

  if (includesOwner(event, "dylan")) {
    return personalDirectory.dylan.prefix;
  }

  if (includesOwner(event, "john")) {
    return personalDirectory.john.prefix;
  }

  return "TEAM";
}

function getViewTitle(scope: CalendarScope) {
  if (scope === "personal") {
    return "Personal Calendar";
  }

  if (scope === "brand-campaign") {
    return "Brand & Campaign Calendar";
  }

  return "Main Calendar";
}

function getCreateButtonLabel(scope: CalendarScope) {
  if (scope === "personal") {
    return "Create Personal Entry";
  }

  if (scope === "brand-campaign") {
    return "Create Brand/Campaign";
  }

  return "Create Meeting";
}

function blankEventForm(dateValue: Date | undefined, scope: CalendarScope, owner: PersonalOwnerFilter): EventFormState {
  const start = dateValue ? new Date(dateValue) : new Date();

  if (!dateValue) {
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 1);
  } else {
    start.setHours(9, 0, 0, 0);
  }

  const end = new Date(start);
  end.setHours(start.getHours() + 1);

  return {
    id: null,
    title: "",
    description: "",
    imageUrl: "",
    location: "",
    meetingLink: "",
    internalNotes: "",
    status: "planned",
    eventType: scope === "brand-campaign" ? "event" : "meeting",
    calendarScope: scope,
    personalOwner: owner === "all" ? "dylan" : owner,
    brandCampaignType: "campaign",
    startsAt: toLocalInputValue(start.toISOString()),
    endsAt: toLocalInputValue(end.toISOString()),
    startDate: toLocalDateValue(start.toISOString()),
    durationDays: "1",
    attendeeEmails: "",
    includeBoth: false,
    notifyBoth: false
  };
}

function mapEventToForm(event: CalendarEvent): EventFormState {
  const dayLength = Math.max(
    1,
    Math.round((new Date(event.endsAt).getTime() - new Date(event.startsAt).getTime()) / (24 * 60 * 60 * 1000))
  );

  return {
    id: event.id,
    title: event.title,
    description: event.description ?? "",
    imageUrl: event.imageUrl ?? "",
    location: event.location ?? "",
    meetingLink: event.meetingLink ?? "",
    internalNotes: event.internalNotes ?? "",
    status: event.status,
    eventType: event.eventType,
    calendarScope: event.calendarScope,
    personalOwner: event.personalOwner ?? "dylan",
    brandCampaignType: event.brandCampaignType ?? "campaign",
    startsAt: toLocalInputValue(event.startsAt),
    endsAt: toLocalInputValue(event.endsAt),
    startDate: toLocalDateValue(event.startsAt),
    durationDays: `${dayLength}`,
    attendeeEmails: event.attendees.map((attendee) => attendee.email).join(", "),
    includeBoth: hasBothOwners(event),
    notifyBoth: event.notifyBoth
  };
}

function applyFallbackEnd(start: Date, end: Date | null, scope: CalendarScope) {
  if (end) {
    return end;
  }

  const fallback = new Date(start);
  if (scope === "brand-campaign") {
    fallback.setDate(fallback.getDate() + 1);
  } else {
    fallback.setHours(fallback.getHours() + 1);
  }

  return fallback;
}

function formatEntryRange(entry: CalendarEvent) {
  const start = new Date(entry.startsAt);
  const end = new Date(entry.endsAt);

  if (entry.allDay) {
    const endDisplay = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    const startLabel = dateFormatter.format(start);
    const endLabel = dateFormatter.format(endDisplay);
    return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
  }

  return `${dateTimeFormatter.format(start)} - ${timeFormatter.format(end)}`;
}

export function CalendarDashboardClient({
  initialEvents,
  initialView = "main"
}: CalendarDashboardClientProps) {
  const [events, setEvents] = useState(initialEvents);
  const [selectedStatuses, setSelectedStatuses] = useState<MeetingStatus[]>(statusOptions);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [activeView] = useState<CalendarScope>(initialView);
  const [personalOwnerFilter, setPersonalOwnerFilter] = useState<PersonalOwnerFilter>("all");
  const [formState, setFormState] = useState<EventFormState>(
    blankEventForm(undefined, initialView, "all")
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredEventsByView = useMemo(
    () =>
      events
        .filter((event) => selectedStatuses.includes(event.status))
        .filter((event) => {
          if (activeView === "personal") {
            if (event.calendarScope !== "personal") {
              return false;
            }

            if (personalOwnerFilter === "all") {
              return true;
            }

            return includesOwner(event, personalOwnerFilter);
          }

          if (activeView === "brand-campaign") {
            return event.calendarScope === "brand-campaign";
          }

          return event.calendarScope === "main" || event.calendarScope === "personal";
        }),
    [events, selectedStatuses, activeView, personalOwnerFilter]
  );

  const calendarEvents: EventInput[] = useMemo(
    () =>
      filteredEventsByView.flatMap((event) => {
        const sharedPersonal = event.calendarScope === "personal" && hasBothOwners(event);
        const personalColor =
          sharedPersonal
            ? alignedPersonalColor
            : includesOwner(event, "john")
              ? personalDirectory.john.color
              : personalDirectory.dylan.color;

        const backgroundColor =
          event.calendarScope === "brand-campaign"
            ? event.brandCampaignType === "brand"
              ? brandColor
              : campaignColor
            : event.calendarScope === "personal"
              ? personalColor
              : event.eventType === "task"
                ? taskColor
                : event.eventType === "event"
                  ? defaultEventColor
                  : statusColorMap[event.status];

        const textColor =
          event.calendarScope === "brand-campaign" || event.eventType === "task" ? "#0f172a" : "#ffffff";

        const title =
          activeView === "main" && event.calendarScope === "personal"
            ? `${getPersonalPrefix(event)} · ${event.title}`
            : event.title;

        const mainEvent: EventInput = {
          id: event.id,
          title,
          start: event.startsAt,
          end: event.endsAt,
          allDay: event.allDay,
          backgroundColor,
          borderColor: backgroundColor,
          textColor,
          extendedProps: { event }
        };

        if (!event.allDay) {
          return [mainEvent];
        }

        const backgroundLayer: EventInput = {
          id: `${event.id}__bg`,
          start: event.startsAt,
          end: event.endsAt,
          allDay: true,
          display: "background",
          backgroundColor: withOpacity(backgroundColor, 0.22),
          classNames: ["tsl-all-day-bg"],
          extendedProps: { eventId: event.id }
        };

        return [backgroundLayer, mainEvent];
      }),
    [filteredEventsByView, activeView]
  );

  const upcomingEntries = useMemo(
    () =>
      [...filteredEventsByView]
        .filter((event) => new Date(event.endsAt) > new Date())
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
        .slice(0, 8),
    [filteredEventsByView]
  );

  async function fetchEvents(statuses: MeetingStatus[]) {
    const params = new URLSearchParams();
    params.set("statuses", statuses.join(","));

    const response = await fetch(`/api/calendar/events?${params.toString()}`);
    if (!response.ok) {
      throw new Error("Could not load calendar events.");
    }

    const payload = (await response.json()) as { events: CalendarEvent[] };
    setEvents(payload.events);
  }

  async function refreshEvents(nextStatuses = selectedStatuses) {
    setLoading(true);
    setError(null);

    try {
      await fetchEvents(nextStatuses);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to refresh calendar events.");
    } finally {
      setLoading(false);
    }
  }

  function handleDateClick(argument: DateClickArg) {
    setFormMode("create");
    setFormState(blankEventForm(argument.date, activeView, personalOwnerFilter));
    setFormOpen(true);
  }

  function handleEventClick(argument: EventClickArg) {
    const eventData = argument.event.extendedProps.event as CalendarEvent | undefined;
    if (!eventData) {
      return;
    }

    setFormMode("edit");
    setFormState(mapEventToForm(eventData));
    setFormOpen(true);
  }

  async function handleEventMove({
    id,
    start,
    end,
    revert,
    eventData
  }: {
    id: string;
    start: Date | null;
    end: Date | null;
    revert: () => void;
    eventData: CalendarEvent | undefined;
  }) {
    if (!id || !start || !eventData) {
      return;
    }

    const resolvedEnd = applyFallbackEnd(start, end, eventData.calendarScope);

    const response = await fetch("/api/calendar/events", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id,
        mode: "timing",
        startsAt: start.toISOString(),
        endsAt: resolvedEnd.toISOString()
      })
    });

    if (!response.ok) {
      revert();
      setError("Could not move entry. Please try again.");
      return;
    }

    await refreshEvents();
  }

  async function handleEventDrop(argument: EventDropArg) {
    await handleEventMove({
      id: argument.event.id,
      start: argument.event.start,
      end: argument.event.end,
      revert: argument.revert,
      eventData: argument.event.extendedProps.event as CalendarEvent | undefined
    });
  }

  async function handleEventResize(argument: EventResizeDoneArg) {
    await handleEventMove({
      id: argument.event.id,
      start: argument.event.start,
      end: argument.event.end,
      revert: argument.revert,
      eventData: argument.event.extendedProps.event as CalendarEvent | undefined
    });
  }

  function updateField(field: keyof EventFormState, value: string | boolean) {
    setFormState((previous) => ({ ...previous, [field]: value }));
  }

  async function submitForm() {
    if (!formState.title.trim()) {
      setError("Entry title is required.");
      return;
    }

    const calendarScope = formState.calendarScope;
    const eventType = calendarScope === "brand-campaign" ? "event" : formState.eventType;

    let startsAt = formState.startsAt;
    let endsAt = formState.endsAt;

    if (calendarScope === "brand-campaign") {
      if (!formState.startDate) {
        setError("Start date is required for brand/campaign entries.");
        return;
      }

      const durationDays = Math.max(1, Number.parseInt(formState.durationDays || "1", 10));
      const start = new Date(fromLocalDateValue(formState.startDate));
      const end = new Date(start);
      end.setDate(end.getDate() + durationDays);

      startsAt = toLocalInputValue(start.toISOString());
      endsAt = toLocalInputValue(end.toISOString());
    }

    const attendeeEmails = uniqueEmails(
      formState.attendeeEmails
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    );

    if (calendarScope === "personal") {
      const ownerEmail = personalDirectory[formState.personalOwner].email;
      attendeeEmails.push(ownerEmail);

      if (formState.includeBoth || formState.notifyBoth) {
        attendeeEmails.push(personalDirectory[getOtherOwner(formState.personalOwner)].email);
      }
    }

    const dedupedAttendees = uniqueEmails(attendeeEmails);

    const payload = {
      title: formState.title,
      description: formState.description,
      imageUrl: formState.imageUrl,
      location: formState.location,
      meetingLink: formState.meetingLink,
      internalNotes: formState.internalNotes,
      status: formState.status,
      eventType,
      allDay: calendarScope === "brand-campaign",
      calendarScope,
      personalOwner: calendarScope === "personal" ? formState.personalOwner : null,
      brandCampaignType: calendarScope === "brand-campaign" ? formState.brandCampaignType : null,
      notifyBoth: calendarScope === "personal" ? formState.notifyBoth : false,
      startsAt: fromLocalInputValue(startsAt),
      endsAt: fromLocalInputValue(endsAt),
      attendeeEmails: dedupedAttendees
    };

    setLoading(true);
    setError(null);

    try {
      if (formMode === "create") {
        const response = await fetch("/api/calendar/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error("Failed creating entry.");
        }
      }

      if (formMode === "edit" && formState.id) {
        const response = await fetch("/api/calendar/events", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: formState.id,
            mode: "full",
            event: payload
          })
        });

        if (!response.ok) {
          throw new Error("Failed updating entry.");
        }
      }

      setFormOpen(false);
      setFormState(blankEventForm(undefined, activeView, personalOwnerFilter));
      await refreshEvents();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Entry save failed.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteEntry() {
    if (!formState.id) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/calendar/events?id=${formState.id}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("Failed deleting entry.");
      }

      setFormOpen(false);
      setFormState(blankEventForm(undefined, activeView, personalOwnerFilter));
      await refreshEvents();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not delete entry.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleStatus(status: MeetingStatus) {
    const nextStatuses = selectedStatuses.includes(status)
      ? selectedStatuses.filter((item) => item !== status)
      : [...selectedStatuses, status];

    if (!nextStatuses.length) {
      return;
    }

    setSelectedStatuses(nextStatuses);
    await refreshEvents(nextStatuses);
  }

  function renderCalendarEventContent(argument: EventContentArg) {
    const layout = getCalendarEventTextLayout(argument);
    const eventData = argument.event.extendedProps.event as CalendarEvent | undefined;
    const showImage = Boolean(eventData?.imageUrl) && layout.titleClamp >= 2;

    return (
      <div className="flex h-full w-full flex-col gap-px overflow-hidden px-1 py-[1px]">
        {argument.timeText ? (
          <div
            className="truncate leading-tight"
            style={{
              color: argument.textColor ?? "#ffffff",
              fontSize: layout.timeFontSize
            }}
          >
            {argument.timeText}
          </div>
        ) : null}
        <div
          className="break-words leading-[1.08]"
          style={{
            fontSize: layout.titleFontSize,
            wordBreak: "break-word",
            overflowWrap: "anywhere",
            color: argument.textColor ?? "#ffffff",
            display: "-webkit-box",
            WebkitLineClamp: layout.titleClamp,
            WebkitBoxOrient: "vertical",
            overflow: "hidden"
          }}
        >
          {argument.event.title}
        </div>
        {showImage ? (
          <img
            src={eventData?.imageUrl ?? ""}
            alt={argument.event.title}
            className="mt-0.5 h-5 w-5 self-end rounded object-cover"
            loading="lazy"
          />
        ) : null}
      </div>
    );
  }

  const viewSubtitle =
    activeView === "personal"
      ? "Separate Dylan and John calendars with shared scheduling + alignment controls."
      : activeView === "brand-campaign"
        ? "Light blue blocks for brand activity and light green blocks for campaigns across selected days."
        : "Main operational calendar with personal entries mirrored in-line for alignment.";

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.7fr_0.8fr]">
      <CalendarShell title={getViewTitle(activeView)} subtitle={viewSubtitle}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((status) => (
              <Button
                key={status}
                size="sm"
                variant={selectedStatuses.includes(status) ? "default" : "outline"}
                onClick={() => toggleStatus(status)}
              >
                {getStatusLabel(status)}
              </Button>
            ))}
          </div>
          <Button
            onClick={() => {
              setFormMode("create");
              setFormState(blankEventForm(undefined, activeView, personalOwnerFilter));
              setFormOpen(true);
            }}
          >
            {getCreateButtonLabel(activeView)}
          </Button>
        </div>

        {activeView === "personal" ? (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-muted/35 px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Show</span>
            <Select
              value={personalOwnerFilter}
              onValueChange={(value) => setPersonalOwnerFilter(value as PersonalOwnerFilter)}
            >
              <SelectTrigger className="w-[220px] bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Both Personal Calendars</SelectItem>
                <SelectItem value="dylan">Dylan Calendar</SelectItem>
                <SelectItem value="john">John Calendar</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {error ? (
          <p className="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        ) : null}

        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              locale={enGbLocale}
              initialView={activeView === "brand-campaign" ? "dayGridMonth" : "timeGridWeek"}
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,timeGridWeek,timeGridDay"
              }}
              editable
              selectable
              dayMaxEvents
              eventDrop={handleEventDrop}
              eventResize={handleEventResize}
              dateClick={handleDateClick}
              eventClick={handleEventClick}
              eventContent={renderCalendarEventContent}
              eventDidMount={(eventInfo) => {
                eventInfo.el.title = eventInfo.event.title;
              }}
              events={calendarEvents}
              eventMinHeight={34}
              slotMinTime="06:00:00"
              slotMaxTime="22:00:00"
              height="auto"
            />
          </div>
        </div>
      </CalendarShell>

      <div className="space-y-6">
        <CalendarShell title="Upcoming Entries">
          <div className="space-y-3">
            {upcomingEntries.length ? (
              upcomingEntries.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-border/70 bg-muted/40 px-3 py-3">
                  <p className="text-sm font-semibold text-foreground">
                    {entry.calendarScope === "personal" ? `${getPersonalPrefix(entry)} · ${entry.title}` : entry.title}
                  </p>
                  <RangeLabel label={getStatusLabel(entry.status)} />

                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatEntryRange(entry)}
                  </p>
                  {entry.imageUrl ? (
                    <div className="mt-2 overflow-hidden rounded-lg border border-border/60">
                      <img
                        src={entry.imageUrl}
                        alt={entry.title}
                        className="h-16 w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {entry.location ??
                      (entry.calendarScope === "brand-campaign"
                        ? entry.brandCampaignType === "brand"
                          ? "Brand activity"
                          : "Campaign window"
                        : "No location")}
                  </p>
                </div>
              ))
            ) : (
              <EmptyState message="No upcoming entries in this filter." />
            )}
          </div>
        </CalendarShell>

        <CalendarShell title="Filter Summary">
          <p className="text-sm text-muted-foreground">
            Showing {filteredEventsByView.length} entries in {getViewTitle(activeView)} across {selectedStatuses.length} status
            filters.
          </p>
          {loading ? <p className="mt-2 text-xs text-muted-foreground">Refreshing calendar...</p> : null}
        </CalendarShell>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{formMode === "create" ? "Create Entry" : "Edit Entry"}</DialogTitle>
            <DialogDescription>
              {formState.calendarScope === "brand-campaign"
                ? "Schedule brand or campaign blocks that span one or many days."
                : formState.calendarScope === "personal"
                  ? "Personal scheduling for Dylan and John, with optional shared attendance."
                  : "Main operations scheduling with attendees, links, and notes."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid max-h-[70vh] gap-4 overflow-y-auto pr-2 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formState.title}
                onChange={(event) => updateField("title", event.target.value)}
                placeholder="Weekly Growth Standup"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="imageUrl">Image URL (optional)</Label>
              <Input
                id="imageUrl"
                value={formState.imageUrl}
                onChange={(event) => updateField("imageUrl", event.target.value)}
                placeholder="https://cdn.example.com/calendar-entry.jpg"
              />
            </div>

            {formState.calendarScope !== "brand-campaign" ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="startsAt">Start</Label>
                  <Input
                    id="startsAt"
                    type="datetime-local"
                    value={formState.startsAt}
                    onChange={(event) => updateField("startsAt", event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="endsAt">End</Label>
                  <Input
                    id="endsAt"
                    type="datetime-local"
                    value={formState.endsAt}
                    onChange={(event) => updateField("endsAt", event.target.value)}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formState.startDate}
                    onChange={(event) => updateField("startDate", event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="durationDays">Duration (days)</Label>
                  <Input
                    id="durationDays"
                    type="number"
                    min={1}
                    step={1}
                    value={formState.durationDays}
                    onChange={(event) => updateField("durationDays", event.target.value)}
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select value={formState.status} onValueChange={(value) => updateField("status", value)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {getStatusLabel(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formState.calendarScope === "brand-campaign" ? (
              <div className="space-y-1.5">
                <Label htmlFor="brandCampaignType">Entry Type</Label>
                <Select
                  value={formState.brandCampaignType}
                  onValueChange={(value) => updateField("brandCampaignType", value)}
                >
                  <SelectTrigger id="brandCampaignType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="campaign">Campaign (light green)</SelectItem>
                    <SelectItem value="brand">Brand (light blue)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="eventType">Entry Type</Label>
                <Select value={formState.eventType} onValueChange={(value) => updateField("eventType", value)}>
                  <SelectTrigger id="eventType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {eventTypeOptions.map((eventType) => (
                      <SelectItem key={eventType} value={eventType}>
                        {eventType}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formState.calendarScope === "personal" ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="owner">Personal Calendar Owner</Label>
                  <Select value={formState.personalOwner} onValueChange={(value) => updateField("personalOwner", value)}>
                    <SelectTrigger id="owner">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dylan">Dylan</SelectItem>
                      <SelectItem value="john">John</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="attendees">Attendees (comma separated emails)</Label>
                  <Input
                    id="attendees"
                    value={formState.attendeeEmails}
                    onChange={(event) => updateField("attendeeEmails", event.target.value)}
                    placeholder="ops@thesnuslife.com"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={formState.includeBoth}
                      onChange={(event) => updateField("includeBoth", event.target.checked)}
                      className="h-4 w-4 rounded border-border"
                    />
                    Include both Dylan and John on this entry.
                  </label>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={formState.notifyBoth}
                      onChange={(event) => updateField("notifyBoth", event.target.checked)}
                      className="h-4 w-4 rounded border-border"
                    />
                    Notify both users (stores shared-notify intent on this entry).
                  </label>
                </div>
              </>
            ) : null}

            {formState.calendarScope !== "personal" && formState.calendarScope !== "brand-campaign" ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={formState.location}
                    onChange={(event) => updateField("location", event.target.value)}
                    placeholder="HQ Boardroom"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="meetingLink">Meeting Link</Label>
                  <Input
                    id="meetingLink"
                    value={formState.meetingLink}
                    onChange={(event) => updateField("meetingLink", event.target.value)}
                    placeholder="https://meet.google.com/..."
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="attendees">Attendees (comma separated emails)</Label>
                  <Input
                    id="attendees"
                    value={formState.attendeeEmails}
                    onChange={(event) => updateField("attendeeEmails", event.target.value)}
                    placeholder="ops@thesnuslife.com, marketing@thesnuslife.com"
                  />
                </div>
              </>
            ) : null}

            {formState.calendarScope === "brand-campaign" ? (
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="location">Campaign / Brand Context</Label>
                <Input
                  id="location"
                  value={formState.location}
                  onChange={(event) => updateField("location", event.target.value)}
                  placeholder="Website banner, launch page, PDP refresh, etc."
                />
              </div>
            ) : null}

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formState.description}
                onChange={(event) => updateField("description", event.target.value)}
                placeholder="Agenda and context"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="notes">Internal Notes</Label>
              <Textarea
                id="notes"
                value={formState.internalNotes}
                onChange={(event) => updateField("internalNotes", event.target.value)}
                placeholder="Internal prep notes"
              />
            </div>
          </div>

          <DialogFooter>
            {formMode === "edit" ? (
              <Button variant="danger" onClick={deleteEntry} disabled={loading}>
                Delete
              </Button>
            ) : null}
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitForm} disabled={loading}>
              {loading ? "Saving..." : formMode === "create" ? "Create Entry" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
