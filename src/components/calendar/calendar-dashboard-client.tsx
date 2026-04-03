"use client";

import { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import type { DateClickArg, EventResizeDoneArg } from "@fullcalendar/interaction";
import type { EventClickArg, EventContentArg, EventDropArg, EventInput } from "@fullcalendar/core";

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
import type { CalendarEvent, CalendarEventType, MeetingStatus } from "@/types/calendar";

interface CalendarDashboardClientProps {
  initialEvents: CalendarEvent[];
}

interface MeetingFormState {
  id: string | null;
  eventType: CalendarEventType;
  title: string;
  description: string;
  location: string;
  meetingLink: string;
  internalNotes: string;
  status: MeetingStatus;
  startsAt: string;
  endsAt: string;
  startDate: string;
  durationDays: string;
  attendeeEmails: string;
}

const statusOptions: MeetingStatus[] = ["planned", "confirmed", "done", "cancelled"];
const calendarEventTypeOptions: CalendarEventType[] = ["meeting", "event", "task"];
const MS_DAY = 24 * 60 * 60 * 1000;

const statusColorMap: Record<MeetingStatus, string> = {
  planned: "#2f74ff",
  confirmed: "#0ea5a3",
  done: "#16915f",
  cancelled: "#d14343"
};

const nonMeetingColorMap: Record<Exclude<CalendarEventType, "meeting">, { bg: string; border: string; text: string }> = {
  event: { bg: "#f8d7da", border: "#ef9a9a", text: "#7b2323" },
  task: { bg: "#fff5cc", border: "#e3cc79", text: "#5d4c10" }
};

function getDynamicEventTitleFontSize(title: string) {
  const length = title.trim().length;

  if (length <= 12) {
    return "1rem";
  }

  if (length <= 20) {
    return "0.9rem";
  }

  if (length <= 30) {
    return "0.82rem";
  }

  if (length <= 42) {
    return "0.74rem";
  }

  return "0.68rem";
}

function renderCalendarEventContent(argument: EventContentArg) {
  const titleSize = getDynamicEventTitleFontSize(argument.event.title ?? "");

  return (
    <div className="flex h-full w-full flex-col overflow-hidden leading-tight">
      {argument.timeText ? (
        <span className="truncate font-semibold" style={{ fontSize: "0.68rem", lineHeight: 1.1 }}>
          {argument.timeText}
        </span>
      ) : null}
      <span
        className="font-semibold"
        style={{
          fontSize: titleSize,
          lineHeight: 1.12,
          overflowWrap: "anywhere",
          wordBreak: "break-word"
        }}
      >
        {argument.event.title}
      </span>
    </div>
  );
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
  const date = new Date(isoDate);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 10);
}

function fromLocalDateStart(dateValue: string) {
  return new Date(`${dateValue}T00:00`).toISOString();
}

function addDays(isoDate: string, days: number) {
  const next = new Date(isoDate);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString();
}

function buildAllDayRange(startDate: string, durationDays: number) {
  const normalizedDuration = Math.max(1, durationDays);
  const startsAt = fromLocalDateStart(startDate);
  const endsAt = addDays(startsAt, normalizedDuration);
  return { startsAt, endsAt };
}

function blankMeetingForm(dateValue?: Date): MeetingFormState {
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
    eventType: "meeting",
    title: "",
    description: "",
    location: "",
    meetingLink: "",
    internalNotes: "",
    status: "planned" as MeetingStatus,
    startsAt: toLocalInputValue(start.toISOString()),
    endsAt: toLocalInputValue(end.toISOString()),
    startDate: toLocalDateValue(start.toISOString()),
    durationDays: "1",
    attendeeEmails: ""
  };
}

function blankEventForm(dateValue?: Date): MeetingFormState {
  const start = dateValue ? new Date(dateValue) : new Date();
  start.setHours(0, 0, 0, 0);

  return {
    ...blankMeetingForm(start),
    eventType: "event",
    location: "",
    meetingLink: "",
    attendeeEmails: "",
    startDate: toLocalDateValue(start.toISOString()),
    durationDays: "3"
  };
}

function blankTaskForm(dateValue?: Date): MeetingFormState {
  const start = dateValue ? new Date(dateValue) : new Date();
  start.setHours(0, 0, 0, 0);

  return {
    ...blankMeetingForm(start),
    eventType: "task",
    location: "",
    meetingLink: "",
    attendeeEmails: "",
    startDate: toLocalDateValue(start.toISOString()),
    durationDays: "1"
  };
}

function mapEventToForm(event: CalendarEvent): MeetingFormState {
  const allDayDurationDays = Math.max(
    1,
    Math.round((new Date(event.endsAt).getTime() - new Date(event.startsAt).getTime()) / MS_DAY)
  );

  return {
    id: event.id,
    eventType: event.eventType,
    title: event.title,
    description: event.description ?? "",
    location: event.location ?? "",
    meetingLink: event.meetingLink ?? "",
    internalNotes: event.internalNotes ?? "",
    status: event.status,
    startsAt: toLocalInputValue(event.startsAt),
    endsAt: toLocalInputValue(event.endsAt),
    startDate: toLocalDateValue(event.startsAt),
    durationDays: String(allDayDurationDays),
    attendeeEmails: event.attendees.map((attendee) => attendee.email).join(", ")
  };
}

export function CalendarDashboardClient({ initialEvents }: CalendarDashboardClientProps) {
  const [events, setEvents] = useState(initialEvents);
  const [selectedStatuses, setSelectedStatuses] = useState<MeetingStatus[]>(statusOptions);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formState, setFormState] = useState<MeetingFormState>(blankMeetingForm());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calendarEvents: EventInput[] = useMemo(
    () =>
      events
        .filter((event) =>
          event.eventType === "meeting" ? selectedStatuses.includes(event.status) : true
        )
        .map((event) => ({
          id: event.id,
          title: event.title,
          start: event.startsAt,
          end: event.endsAt,
          allDay: event.allDay,
          backgroundColor:
            event.eventType === "meeting"
              ? statusColorMap[event.status]
              : nonMeetingColorMap[event.eventType].bg,
          borderColor:
            event.eventType === "meeting"
              ? statusColorMap[event.status]
              : nonMeetingColorMap[event.eventType].border,
          textColor: event.eventType === "meeting" ? "#ffffff" : nonMeetingColorMap[event.eventType].text,
          durationEditable: event.eventType !== "task",
          extendedProps: { event }
        })),
    [events, selectedStatuses]
  );

  const upcomingMeetings = useMemo(
    () =>
      [...events]
        .filter((event) => event.eventType === "meeting" && new Date(event.endsAt) > new Date())
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
        .slice(0, 8),
    [events]
  );

  async function fetchEvents() {
    const response = await fetch("/api/calendar/events");
    if (!response.ok) {
      throw new Error("Could not load calendar events.");
    }

    const payload = (await response.json()) as { events: CalendarEvent[] };
    setEvents(payload.events);
  }

  async function refreshEvents() {
    setLoading(true);
    setError(null);

    try {
      await fetchEvents();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to refresh calendar events.");
    } finally {
      setLoading(false);
    }
  }

  function handleDateClick(argument: DateClickArg) {
    openCreateForm("meeting", argument.date);
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
    event,
    revert
  }: {
    event: EventDropArg["event"] | EventResizeDoneArg["event"];
    revert: () => void;
  }) {
    const sourceEvent = event.extendedProps.event as CalendarEvent | undefined;
    if (!event.id || !event.start) {
      return;
    }

    let nextStart = new Date(event.start);
    let nextEnd = event.end ? new Date(event.end) : null;

    if (sourceEvent?.eventType !== "meeting") {
      const currentDurationDays = Math.max(
        1,
        Math.round(
          (new Date(sourceEvent?.endsAt ?? nextStart).getTime() -
            new Date(sourceEvent?.startsAt ?? nextStart).getTime()) /
            MS_DAY
        )
      );

      nextStart.setHours(0, 0, 0, 0);
      const movedDurationDays =
        nextEnd && event.start
          ? Math.max(1, Math.round((nextEnd.getTime() - event.start.getTime()) / MS_DAY))
          : currentDurationDays;
      const durationDays = sourceEvent?.eventType === "task" ? 1 : movedDurationDays;
      nextEnd = new Date(nextStart);
      nextEnd.setDate(nextEnd.getDate() + durationDays);
    } else if (!nextEnd) {
      nextEnd = new Date(nextStart);
      nextEnd.setHours(nextEnd.getHours() + 1);
    }

    const response = await fetch("/api/calendar/events", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id: event.id,
        mode: "timing",
        startsAt: nextStart.toISOString(),
        endsAt: nextEnd.toISOString()
      })
    });

    if (!response.ok) {
      revert();
      setError("Could not move calendar item. Please try again.");
      return;
    }

    await refreshEvents();
  }

  async function handleEventDrop(argument: EventDropArg) {
    await handleEventMove({
      event: argument.event,
      revert: argument.revert
    });
  }

  async function handleEventResize(argument: EventResizeDoneArg) {
    await handleEventMove({
      event: argument.event,
      revert: argument.revert
    });
  }

  function openCreateForm(eventType: CalendarEventType, dateValue?: Date) {
    setFormMode("create");

    if (eventType === "meeting") {
      setFormState(blankMeetingForm(dateValue));
    } else if (eventType === "event") {
      setFormState(blankEventForm(dateValue));
    } else {
      setFormState(blankTaskForm(dateValue));
    }

    setFormOpen(true);
  }

  function updateField(field: keyof MeetingFormState, value: string) {
    setFormState((previous) => ({ ...previous, [field]: value }));
  }

  const isMeetingForm = formState.eventType === "meeting";
  const isCampaignEventForm = formState.eventType === "event";
  const isTaskForm = formState.eventType === "task";

  const formTitle =
    formMode === "create"
      ? formState.eventType === "meeting"
        ? "Create Meeting"
        : formState.eventType === "event"
          ? "Create Event"
          : "Add Task"
      : formState.eventType === "meeting"
        ? "Edit Meeting"
        : formState.eventType === "event"
          ? "Edit Event"
          : "Edit Task";

  const formDescription = isMeetingForm
    ? "Capture full meeting details, attendees, link and internal notes."
    : isCampaignEventForm
      ? "Create a multi-day event block. Meetings can still be scheduled inside those days."
      : "Create a task item that can be moved to different days in week/month view.";

  function buildPayloadFromFormState() {
    const attendeeEmails = isMeetingForm
      ? formState.attendeeEmails
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : [];

    if (isMeetingForm) {
      return {
        eventType: "meeting" as const,
        title: formState.title,
        description: formState.description,
        location: formState.location,
        meetingLink: formState.meetingLink,
        internalNotes: formState.internalNotes,
        status: formState.status,
        allDay: false,
        startsAt: fromLocalInputValue(formState.startsAt),
        endsAt: fromLocalInputValue(formState.endsAt),
        attendeeEmails
      };
    }

    const durationDays = isTaskForm ? 1 : Math.max(1, Number.parseInt(formState.durationDays || "1", 10) || 1);
    const { startsAt, endsAt } = buildAllDayRange(formState.startDate, durationDays);

    return {
      eventType: formState.eventType,
      title: formState.title,
      description: formState.description,
      location: isCampaignEventForm ? formState.location : "",
      meetingLink: "",
      internalNotes: formState.internalNotes,
      status: formState.status,
      allDay: true,
      startsAt,
      endsAt,
      attendeeEmails
    };
  }

  async function submitForm() {
    if (!formState.title.trim()) {
      setError("Title is required.");
      return;
    }

    if (!isMeetingForm && !formState.startDate) {
      setError("Please select a date.");
      return;
    }

    const payload = buildPayloadFromFormState();
    if (!payload.startsAt || !payload.endsAt || Number.isNaN(new Date(payload.startsAt).getTime()) || Number.isNaN(new Date(payload.endsAt).getTime())) {
      setError("Invalid date/time values.");
      return;
    }
    if (new Date(payload.endsAt) <= new Date(payload.startsAt)) {
      setError("End must be after start.");
      return;
    }

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
      setFormState(blankMeetingForm());
      await refreshEvents();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Calendar save failed.");
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
      setFormState(blankMeetingForm());
      await refreshEvents();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not delete entry.");
    } finally {
      setLoading(false);
    }
  }

  function toggleStatus(status: MeetingStatus) {
    const nextStatuses = selectedStatuses.includes(status)
      ? selectedStatuses.filter((item) => item !== status)
      : [...selectedStatuses, status];

    if (!nextStatuses.length) {
      return;
    }

    setSelectedStatuses(nextStatuses);
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.7fr_0.8fr]">
      <CalendarShell
        title="Meeting Calendar"
        subtitle="Create meetings, multi-day events and movable tasks with drag/drop support."
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((status) => (
              <Button
                key={status}
                size="sm"
                variant={selectedStatuses.includes(status) ? "default" : "outline"}
                onClick={() => toggleStatus(status)}
              >
                {status}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => openCreateForm("meeting")}>Create Meeting</Button>
            <Button variant="secondary" onClick={() => openCreateForm("event")}>
              Create Event
            </Button>
            <Button variant="outline" onClick={() => openCreateForm("task")}>
              Add Task
            </Button>
          </div>
        </div>

        {error ? (
          <p className="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        ) : null}

        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,timeGridWeek,timeGridDay"
              }}
              editable
              selectable
              dayMaxEvents
              eventOverlap
              eventDrop={handleEventDrop}
              eventResize={handleEventResize}
              dateClick={handleDateClick}
              eventClick={handleEventClick}
              eventContent={renderCalendarEventContent}
              eventDidMount={(info) => {
                info.el.title = info.event.title;
              }}
              events={calendarEvents}
              slotMinTime="06:00:00"
              slotMaxTime="22:00:00"
              height="auto"
            />
          </div>
        </div>
      </CalendarShell>

      <div className="space-y-6">
        <CalendarShell title="Upcoming Meetings">
          <div className="space-y-3">
            {upcomingMeetings.length ? (
              upcomingMeetings.map((meeting) => (
                <div key={meeting.id} className="rounded-xl border border-border/70 bg-muted/40 px-3 py-3">
                  <p className="text-sm font-semibold text-foreground">{meeting.title}</p>
                  <RangeLabel label={meeting.status} />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(meeting.startsAt).toLocaleString()} - {new Date(meeting.endsAt).toLocaleTimeString()}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{meeting.location ?? "No location"}</p>
                </div>
              ))
            ) : (
              <EmptyState message="No upcoming meetings in this filter." />
            )}
          </div>
        </CalendarShell>

        <CalendarShell title="Filter Summary">
          <p className="text-sm text-muted-foreground">
            Showing {calendarEvents.length} entries. Meeting status filters affect meetings only.
          </p>
          {loading ? <p className="mt-2 text-xs text-muted-foreground">Refreshing calendar...</p> : null}
        </CalendarShell>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{formTitle}</DialogTitle>
            <DialogDescription>{formDescription}</DialogDescription>
          </DialogHeader>

          <div className="grid max-h-[70vh] gap-4 overflow-y-auto pr-2 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="entryType">Type</Label>
              <Select
                value={formState.eventType}
                onValueChange={(value) => updateField("eventType", value as CalendarEventType)}
                disabled={formMode === "edit"}
              >
                <SelectTrigger id="entryType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {calendarEventTypeOptions.map((eventType) => (
                    <SelectItem key={eventType} value={eventType}>
                      {eventType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="title">
                {isMeetingForm ? "Meeting Title" : isCampaignEventForm ? "Event Title" : "Task Title"}
              </Label>
              <Input
                id="title"
                value={formState.title}
                onChange={(event) => updateField("title", event.target.value)}
                placeholder={
                  isMeetingForm
                    ? "Weekly Growth Standup"
                    : isCampaignEventForm
                      ? "Campaign Launch Event"
                      : "Review landing page copy"
                }
              />
            </div>

            {isMeetingForm ? (
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
                {isCampaignEventForm ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="durationDays">Duration (days)</Label>
                    <Input
                      id="durationDays"
                      type="number"
                      min={1}
                      value={formState.durationDays}
                      onChange={(event) => updateField("durationDays", event.target.value)}
                    />
                  </div>
                ) : null}
              </>
            )}

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formState.status}
                onValueChange={(value) => updateField("status", value as MeetingStatus)}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
              {loading
                ? "Saving..."
                : formMode === "create"
                  ? isMeetingForm
                    ? "Create Meeting"
                    : isCampaignEventForm
                      ? "Create Event"
                      : "Add Task"
                  : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
