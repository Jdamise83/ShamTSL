"use client";

import { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import type { DateClickArg, EventResizeDoneArg } from "@fullcalendar/interaction";
import type { EventClickArg, EventDropArg, EventInput } from "@fullcalendar/core";

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
import type { CalendarEvent, MeetingStatus } from "@/types/calendar";

interface CalendarDashboardClientProps {
  initialEvents: CalendarEvent[];
}

interface MeetingFormState {
  id: string | null;
  title: string;
  description: string;
  location: string;
  meetingLink: string;
  internalNotes: string;
  status: MeetingStatus;
  startsAt: string;
  endsAt: string;
  attendeeEmails: string;
}

const statusOptions: MeetingStatus[] = ["planned", "confirmed", "done", "cancelled"];

const statusColorMap: Record<MeetingStatus, string> = {
  planned: "#2f74ff",
  confirmed: "#0ea5a3",
  done: "#16915f",
  cancelled: "#d14343"
};

function toLocalInputValue(isoDate: string) {
  const date = new Date(isoDate);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

function fromLocalInputValue(localDateTime: string) {
  return new Date(localDateTime).toISOString();
}

function blankMeetingForm(dateValue?: Date) {
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
    location: "",
    meetingLink: "",
    internalNotes: "",
    status: "planned" as MeetingStatus,
    startsAt: toLocalInputValue(start.toISOString()),
    endsAt: toLocalInputValue(end.toISOString()),
    attendeeEmails: ""
  };
}

function mapEventToForm(event: CalendarEvent): MeetingFormState {
  return {
    id: event.id,
    title: event.title,
    description: event.description ?? "",
    location: event.location ?? "",
    meetingLink: event.meetingLink ?? "",
    internalNotes: event.internalNotes ?? "",
    status: event.status,
    startsAt: toLocalInputValue(event.startsAt),
    endsAt: toLocalInputValue(event.endsAt),
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
        .filter((event) => selectedStatuses.includes(event.status))
        .map((event) => ({
          id: event.id,
          title: event.title,
          start: event.startsAt,
          end: event.endsAt,
          backgroundColor: statusColorMap[event.status],
          borderColor: statusColorMap[event.status],
          extendedProps: { event }
        })),
    [events, selectedStatuses]
  );

  const upcomingMeetings = useMemo(
    () =>
      [...events]
        .filter((event) => new Date(event.endsAt) > new Date())
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
        .slice(0, 8),
    [events]
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
    setFormState(blankMeetingForm(argument.date));
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
    revert
  }: {
    id: string;
    start: Date | null;
    end: Date | null;
    revert: () => void;
  }) {
    if (!id || !start || !end) {
      return;
    }

    const response = await fetch("/api/calendar/events", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id,
        mode: "timing",
        startsAt: start.toISOString(),
        endsAt: end.toISOString()
      })
    });

    if (!response.ok) {
      revert();
      setError("Could not move meeting. Please try again.");
      return;
    }

    await refreshEvents();
  }

  async function handleEventDrop(argument: EventDropArg) {
    await handleEventMove({
      id: argument.event.id,
      start: argument.event.start,
      end: argument.event.end,
      revert: argument.revert
    });
  }

  async function handleEventResize(argument: EventResizeDoneArg) {
    await handleEventMove({
      id: argument.event.id,
      start: argument.event.start,
      end: argument.event.end,
      revert: argument.revert
    });
  }

  function updateField(field: keyof MeetingFormState, value: string) {
    setFormState((previous) => ({ ...previous, [field]: value }));
  }

  async function submitForm() {
    if (!formState.title.trim()) {
      setError("Meeting title is required.");
      return;
    }

    const payload = {
      title: formState.title,
      description: formState.description,
      location: formState.location,
      meetingLink: formState.meetingLink,
      internalNotes: formState.internalNotes,
      status: formState.status,
      startsAt: fromLocalInputValue(formState.startsAt),
      endsAt: fromLocalInputValue(formState.endsAt),
      attendeeEmails: formState.attendeeEmails
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
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
          throw new Error("Failed creating meeting.");
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
          throw new Error("Failed updating meeting.");
        }
      }

      setFormOpen(false);
      setFormState(blankMeetingForm());
      await refreshEvents();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Meeting save failed.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteMeeting() {
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
        throw new Error("Failed deleting meeting.");
      }

      setFormOpen(false);
      setFormState(blankMeetingForm());
      await refreshEvents();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not delete meeting.");
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

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.7fr_0.8fr]">
      <CalendarShell
        title="Meeting Calendar"
        subtitle="Day, week and month scheduling with attendee assignment and drag/drop support."
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
          <Button
            onClick={() => {
              setFormMode("create");
              setFormState(blankMeetingForm());
              setFormOpen(true);
            }}
          >
            Create Meeting
          </Button>
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
              eventDrop={handleEventDrop}
              eventResize={handleEventResize}
              dateClick={handleDateClick}
              eventClick={handleEventClick}
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
            Showing {calendarEvents.length} events across {selectedStatuses.length} status filters.
          </p>
          {loading ? <p className="mt-2 text-xs text-muted-foreground">Refreshing calendar...</p> : null}
        </CalendarShell>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{formMode === "create" ? "Create Meeting" : "Edit Meeting"}</DialogTitle>
            <DialogDescription>
              Capture full meeting details, attendees, link and internal notes.
            </DialogDescription>
          </DialogHeader>

          <div className="grid max-h-[70vh] gap-4 overflow-y-auto pr-2 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="title">Meeting Title</Label>
              <Input
                id="title"
                value={formState.title}
                onChange={(event) => updateField("title", event.target.value)}
                placeholder="Weekly Growth Standup"
              />
            </div>
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
              <Button variant="danger" onClick={deleteMeeting} disabled={loading}>
                Delete
              </Button>
            ) : null}
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitForm} disabled={loading}>
              {loading ? "Saving..." : formMode === "create" ? "Create Meeting" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
