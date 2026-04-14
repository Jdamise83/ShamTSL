"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Save, Trash2 } from "lucide-react";

import { CalendarShell } from "@/components/calendar/calendar-shell";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type {
  SegmentedSubtask,
  SegmentedTask,
  SegmentedTaskBoard,
  SegmentedTaskOwner,
  SegmentedTaskPriority,
  SegmentedTaskStatus
} from "@/types/segmented-task-list";

interface SegmentedTaskBoardClientProps {
  initialBoard: SegmentedTaskBoard;
}

interface TaskDraft {
  title: string;
  owner: SegmentedTaskOwner;
  status: SegmentedTaskStatus;
  priority: SegmentedTaskPriority;
  dueDate: string;
  notes: string;
}

interface SubtaskDraft {
  title: string;
  owner: SegmentedTaskOwner;
  status: SegmentedTaskStatus;
}

const ownerOptions: Array<{ value: SegmentedTaskOwner; label: string }> = [
  { value: "dylan", label: "Dylan" },
  { value: "john", label: "John" },
  { value: "shampt19", label: "Shampt19" },
  { value: "unassigned", label: "Unassigned" }
];

const statusOptions: Array<{ value: SegmentedTaskStatus; label: string; tone: "default" | "success" | "muted" | "danger" }> = [
  { value: "not-started", label: "Not Started", tone: "default" },
  { value: "in-progress", label: "In Progress", tone: "muted" },
  { value: "blocked", label: "Blocked", tone: "danger" },
  { value: "done", label: "Done", tone: "success" }
];

const priorityOptions: Array<{ value: SegmentedTaskPriority; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" }
];

const segmentColorOptions = ["#DBEAFE", "#DCFCE7", "#FCE7F3", "#FEF3C7", "#E0E7FF", "#FEE2E2"];

function taskKey(segmentId: string, taskId: string) {
  return `${segmentId}::${taskId}`;
}

function subtaskKey(segmentId: string, taskId: string, subtaskId: string) {
  return `${segmentId}::${taskId}::${subtaskId}`;
}

function getToneForStatus(status: SegmentedTaskStatus) {
  return statusOptions.find((option) => option.value === status)?.tone ?? "default";
}

function draftFromTask(task: SegmentedTask): TaskDraft {
  return {
    title: task.title,
    owner: task.owner,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate ?? "",
    notes: task.notes ?? ""
  };
}

function draftFromSubtask(subtask: SegmentedSubtask): SubtaskDraft {
  return {
    title: subtask.title,
    owner: subtask.owner,
    status: subtask.status
  };
}

function createBlankTaskDraft(): TaskDraft {
  return {
    title: "",
    owner: "unassigned",
    status: "not-started",
    priority: "medium",
    dueDate: "",
    notes: ""
  };
}

function createBlankSubtaskDraft(): SubtaskDraft {
  return {
    title: "",
    owner: "unassigned",
    status: "not-started"
  };
}

export function SegmentedTaskBoardClient({ initialBoard }: SegmentedTaskBoardClientProps) {
  const [board, setBoard] = useState(initialBoard);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [segmentTitleInput, setSegmentTitleInput] = useState("");
  const [segmentColorInput, setSegmentColorInput] = useState("#DBEAFE");
  const [segmentEdits, setSegmentEdits] = useState<Record<string, { title: string; color: string }>>({});

  const [taskDrafts, setTaskDrafts] = useState<Record<string, TaskDraft>>({});
  const [newTaskDrafts, setNewTaskDrafts] = useState<Record<string, TaskDraft>>({});

  const [subtaskDrafts, setSubtaskDrafts] = useState<Record<string, SubtaskDraft>>({});
  const [newSubtaskDrafts, setNewSubtaskDrafts] = useState<Record<string, SubtaskDraft>>({});
  const [expandedTaskRows, setExpandedTaskRows] = useState<Record<string, boolean>>({});

  const taskCount = useMemo(
    () => board.segments.reduce((total, segment) => total + segment.tasks.length, 0),
    [board]
  );
  const subtaskCount = useMemo(
    () =>
      board.segments.reduce(
        (total, segment) => total + segment.tasks.reduce((sum, task) => sum + task.subtasks.length, 0),
        0
      ),
    [board]
  );

  async function postAction(body: object) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/segmented-task-list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Segmented task action failed.");
      }

      const payload = (await response.json()) as { board: SegmentedTaskBoard };
      setBoard(payload.board);
      return payload.board;
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Segmented task action failed.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  function getSegmentEdit(segmentId: string, title: string, color: string) {
    return segmentEdits[segmentId] ?? { title, color };
  }

  function getTaskDraft(segmentId: string, task: SegmentedTask) {
    return taskDrafts[taskKey(segmentId, task.id)] ?? draftFromTask(task);
  }

  function getNewTaskDraft(segmentId: string) {
    return newTaskDrafts[segmentId] ?? createBlankTaskDraft();
  }

  function getSubtaskDraft(segmentId: string, taskId: string, subtask: SegmentedSubtask) {
    return subtaskDrafts[subtaskKey(segmentId, taskId, subtask.id)] ?? draftFromSubtask(subtask);
  }

  function getNewSubtaskDraft(segmentId: string, taskId: string) {
    return newSubtaskDrafts[taskKey(segmentId, taskId)] ?? createBlankSubtaskDraft();
  }

  function updateTaskDraft(
    segmentId: string,
    taskId: string,
    task: SegmentedTask,
    field: keyof TaskDraft,
    value: string
  ) {
    const key = taskKey(segmentId, taskId);
    setTaskDrafts((previous) => {
      const base = previous[key] ?? draftFromTask(task);
      return { ...previous, [key]: { ...base, [field]: value } };
    });
  }

  function updateNewTaskDraft(segmentId: string, field: keyof TaskDraft, value: string) {
    setNewTaskDrafts((previous) => {
      const base = previous[segmentId] ?? createBlankTaskDraft();
      return { ...previous, [segmentId]: { ...base, [field]: value } };
    });
  }

  function updateSubtaskDraft(
    segmentId: string,
    taskId: string,
    subtaskId: string,
    subtask: SegmentedSubtask,
    field: keyof SubtaskDraft,
    value: string
  ) {
    const key = subtaskKey(segmentId, taskId, subtaskId);
    setSubtaskDrafts((previous) => {
      const base = previous[key] ?? draftFromSubtask(subtask);
      return { ...previous, [key]: { ...base, [field]: value } };
    });
  }

  function updateNewSubtaskDraft(
    segmentId: string,
    taskId: string,
    field: keyof SubtaskDraft,
    value: string
  ) {
    const key = taskKey(segmentId, taskId);
    setNewSubtaskDrafts((previous) => {
      const base = previous[key] ?? createBlankSubtaskDraft();
      return { ...previous, [key]: { ...base, [field]: value } };
    });
  }

  async function createSegment() {
    const title = segmentTitleInput.trim();
    if (!title) {
      setError("Segment title is required.");
      return;
    }

    const nextBoard = await postAction({
      action: "create-segment",
      payload: {
        title,
        color: segmentColorInput
      }
    });

    if (nextBoard) {
      setSegmentTitleInput("");
      setSegmentColorInput("#DBEAFE");
    }
  }

  async function saveSegment(segmentId: string, title: string, color: string) {
    await postAction({
      action: "update-segment",
      payload: {
        segmentId,
        title,
        color
      }
    });
  }

  async function createTask(segmentId: string) {
    const draft = getNewTaskDraft(segmentId);
    if (!draft.title.trim()) {
      setError("Task title is required.");
      return;
    }

    const nextBoard = await postAction({
      action: "create-task",
      payload: {
        segmentId,
        task: {
          ...draft,
          dueDate: draft.dueDate || null,
          notes: draft.notes || null
        }
      }
    });

    if (nextBoard) {
      setNewTaskDrafts((previous) => ({ ...previous, [segmentId]: createBlankTaskDraft() }));
    }
  }

  async function saveTask(segmentId: string, taskId: string, task: SegmentedTask) {
    const draft = getTaskDraft(segmentId, task);
    if (!draft.title.trim()) {
      setError("Task title is required.");
      return;
    }

    await postAction({
      action: "update-task",
      payload: {
        segmentId,
        taskId,
        task: {
          ...draft,
          dueDate: draft.dueDate || null,
          notes: draft.notes || null
        }
      }
    });
  }

  async function removeTask(segmentId: string, taskId: string) {
    await postAction({
      action: "delete-task",
      payload: {
        segmentId,
        taskId
      }
    });
  }

  async function createSubtask(segmentId: string, taskId: string) {
    const draft = getNewSubtaskDraft(segmentId, taskId);
    if (!draft.title.trim()) {
      setError("Subtask title is required.");
      return;
    }

    const nextBoard = await postAction({
      action: "create-subtask",
      payload: {
        segmentId,
        taskId,
        subtask: draft
      }
    });

    if (nextBoard) {
      const key = taskKey(segmentId, taskId);
      setNewSubtaskDrafts((previous) => ({ ...previous, [key]: createBlankSubtaskDraft() }));
    }
  }

  async function saveSubtask(
    segmentId: string,
    taskId: string,
    subtaskId: string,
    subtask: SegmentedSubtask
  ) {
    const draft = getSubtaskDraft(segmentId, taskId, subtask);
    if (!draft.title.trim()) {
      setError("Subtask title is required.");
      return;
    }

    await postAction({
      action: "update-subtask",
      payload: {
        segmentId,
        taskId,
        subtaskId,
        subtask: draft
      }
    });
  }

  async function removeSubtask(segmentId: string, taskId: string, subtaskId: string) {
    await postAction({
      action: "delete-subtask",
      payload: {
        segmentId,
        taskId,
        subtaskId
      }
    });
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-border/80 bg-card">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Segments</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{board.segments.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/80 bg-card">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Parent Tasks</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{taskCount}</p>
          </CardContent>
        </Card>
        <Card className="border-border/80 bg-card">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Subtasks</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{subtaskCount}</p>
          </CardContent>
        </Card>
      </div>

      <CalendarShell title="Create Segment" subtitle="Add a grouped work lane like Monday boards.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_170px_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="segment-title">Segment title</Label>
            <Input
              id="segment-title"
              value={segmentTitleInput}
              onChange={(event) => setSegmentTitleInput(event.target.value)}
              placeholder="Example: Paid Growth"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="segment-color">Color</Label>
            <Input
              id="segment-color"
              type="color"
              value={segmentColorInput}
              onChange={(event) => setSegmentColorInput(event.target.value.toUpperCase())}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={createSegment} disabled={loading} className="w-full md:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Add Segment
            </Button>
          </div>
        </div>
      </CalendarShell>

      {board.segments.length ? (
        board.segments.map((segment) => {
          const edit = getSegmentEdit(segment.id, segment.title, segment.color);

          return (
            <Card
              key={segment.id}
              className="overflow-hidden border-border/80 bg-card"
              style={{ borderLeft: `6px solid ${segment.color}` }}
            >
              <CardHeader className="border-b border-border/60 bg-muted/25 pb-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.6fr_170px_auto]">
                  <div className="space-y-1.5">
                    <Label>Segment Name</Label>
                    <Input
                      value={edit.title}
                      onChange={(event) =>
                        setSegmentEdits((previous) => ({
                          ...previous,
                          [segment.id]: { ...edit, title: event.target.value }
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Segment Color</Label>
                    <Select
                      value={edit.color}
                      onValueChange={(value) =>
                        setSegmentEdits((previous) => ({
                          ...previous,
                          [segment.id]: { ...edit, color: value }
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {segmentColorOptions.map((optionColor) => (
                          <SelectItem key={optionColor} value={optionColor}>
                            {optionColor}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      variant="secondary"
                      onClick={() => saveSegment(segment.id, edit.title, edit.color)}
                      disabled={loading}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      Save Segment
                    </Button>
                  </div>
                </div>
                <CardTitle className="mt-3 text-base uppercase tracking-[0.08em]">
                  {segment.tasks.length} Parent Tasks
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[44px]" />
                        <TableHead>Task</TableHead>
                        <TableHead>Owner</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="w-[110px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {segment.tasks.length ? (
                        segment.tasks.map((task) => {
                          const key = taskKey(segment.id, task.id);
                          const draft = getTaskDraft(segment.id, task);
                          const isExpanded = expandedTaskRows[key] === true;

                          return (
                            <Fragment key={task.id}>
                              <TableRow key={task.id}>
                                <TableCell>
                                  <button
                                    type="button"
                                    className="rounded-md border border-border/70 bg-background p-1"
                                    onClick={() =>
                                      setExpandedTaskRows((previous) => ({
                                        ...previous,
                                        [key]: !isExpanded
                                      }))
                                    }
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                  </button>
                                </TableCell>
                                <TableCell className="min-w-[220px]">
                                  <Input
                                    value={draft.title}
                                    onChange={(event) =>
                                      updateTaskDraft(segment.id, task.id, task, "title", event.target.value)
                                    }
                                    placeholder="Task title"
                                  />
                                </TableCell>
                                <TableCell className="min-w-[150px]">
                                  <Select
                                    value={draft.owner}
                                    onValueChange={(value) =>
                                      updateTaskDraft(segment.id, task.id, task, "owner", value)
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {ownerOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell className="min-w-[160px]">
                                  <Select
                                    value={draft.status}
                                    onValueChange={(value) =>
                                      updateTaskDraft(segment.id, task.id, task, "status", value)
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {statusOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Badge variant={getToneForStatus(draft.status)} className="mt-1 text-[11px]">
                                    {statusOptions.find((option) => option.value === draft.status)?.label}
                                  </Badge>
                                </TableCell>
                                <TableCell className="min-w-[150px]">
                                  <Select
                                    value={draft.priority}
                                    onValueChange={(value) =>
                                      updateTaskDraft(segment.id, task.id, task, "priority", value)
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {priorityOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell className="min-w-[150px]">
                                  <Input
                                    type="date"
                                    value={draft.dueDate}
                                    onChange={(event) =>
                                      updateTaskDraft(segment.id, task.id, task, "dueDate", event.target.value)
                                    }
                                  />
                                </TableCell>
                                <TableCell className="min-w-[240px]">
                                  <Textarea
                                    value={draft.notes}
                                    onChange={(event) =>
                                      updateTaskDraft(segment.id, task.id, task, "notes", event.target.value)
                                    }
                                    className="min-h-[68px]"
                                  />
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={() => saveTask(segment.id, task.id, task)}
                                      disabled={loading}
                                      className="h-9 w-9 p-0"
                                    >
                                      <Save className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="danger"
                                      onClick={() => removeTask(segment.id, task.id)}
                                      disabled={loading}
                                      className="h-9 w-9 p-0"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>

                              {isExpanded ? (
                                <TableRow>
                                  <TableCell colSpan={8} className="bg-muted/20">
                                    <div className="space-y-3 p-2">
                                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                        Subtasks
                                      </p>
                                      {task.subtasks.length ? (
                                        <div className="space-y-2">
                                          {task.subtasks.map((subtask) => {
                                            const subtaskDraft = getSubtaskDraft(segment.id, task.id, subtask);
                                            return (
                                              <div
                                                key={subtask.id}
                                                className="grid grid-cols-1 gap-2 rounded-xl border border-border/70 bg-background p-2 md:grid-cols-[1.7fr_150px_170px_auto]"
                                              >
                                                <Input
                                                  value={subtaskDraft.title}
                                                  onChange={(event) =>
                                                    updateSubtaskDraft(
                                                      segment.id,
                                                      task.id,
                                                      subtask.id,
                                                      subtask,
                                                      "title",
                                                      event.target.value
                                                    )
                                                  }
                                                  placeholder="Subtask title"
                                                />
                                                <Select
                                                  value={subtaskDraft.owner}
                                                  onValueChange={(value) =>
                                                    updateSubtaskDraft(
                                                      segment.id,
                                                      task.id,
                                                      subtask.id,
                                                      subtask,
                                                      "owner",
                                                      value
                                                    )
                                                  }
                                                >
                                                  <SelectTrigger>
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    {ownerOptions.map((option) => (
                                                      <SelectItem key={option.value} value={option.value}>
                                                        {option.label}
                                                      </SelectItem>
                                                    ))}
                                                  </SelectContent>
                                                </Select>
                                                <Select
                                                  value={subtaskDraft.status}
                                                  onValueChange={(value) =>
                                                    updateSubtaskDraft(
                                                      segment.id,
                                                      task.id,
                                                      subtask.id,
                                                      subtask,
                                                      "status",
                                                      value
                                                    )
                                                  }
                                                >
                                                  <SelectTrigger>
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    {statusOptions.map((option) => (
                                                      <SelectItem key={option.value} value={option.value}>
                                                        {option.label}
                                                      </SelectItem>
                                                    ))}
                                                  </SelectContent>
                                                </Select>
                                                <div className="flex items-center gap-2">
                                                  <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={() =>
                                                      saveSubtask(segment.id, task.id, subtask.id, subtask)
                                                    }
                                                    disabled={loading}
                                                    className="h-9 w-9 p-0"
                                                  >
                                                    <Save className="h-4 w-4" />
                                                  </Button>
                                                  <Button
                                                    size="sm"
                                                    variant="danger"
                                                    onClick={() =>
                                                      removeSubtask(segment.id, task.id, subtask.id)
                                                    }
                                                    disabled={loading}
                                                    className="h-9 w-9 p-0"
                                                  >
                                                    <Trash2 className="h-4 w-4" />
                                                  </Button>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <p className="text-sm text-muted-foreground">No subtasks yet.</p>
                                      )}

                                      <div className="grid grid-cols-1 gap-2 rounded-xl border border-dashed border-border/80 bg-background/80 p-2 md:grid-cols-[1.7fr_150px_170px_auto]">
                                        <Input
                                          value={getNewSubtaskDraft(segment.id, task.id).title}
                                          onChange={(event) =>
                                            updateNewSubtaskDraft(
                                              segment.id,
                                              task.id,
                                              "title",
                                              event.target.value
                                            )
                                          }
                                          placeholder="Add subtask"
                                        />
                                        <Select
                                          value={getNewSubtaskDraft(segment.id, task.id).owner}
                                          onValueChange={(value) =>
                                            updateNewSubtaskDraft(segment.id, task.id, "owner", value)
                                          }
                                        >
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {ownerOptions.map((option) => (
                                              <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <Select
                                          value={getNewSubtaskDraft(segment.id, task.id).status}
                                          onValueChange={(value) =>
                                            updateNewSubtaskDraft(segment.id, task.id, "status", value)
                                          }
                                        >
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {statusOptions.map((option) => (
                                              <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <Button
                                          variant="secondary"
                                          onClick={() => createSubtask(segment.id, task.id)}
                                          disabled={loading}
                                        >
                                          <Plus className="mr-2 h-4 w-4" />
                                          Add Subtask
                                        </Button>
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ) : null}
                            </Fragment>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={8}>
                            <EmptyState message="No parent tasks in this segment yet." />
                          </TableCell>
                        </TableRow>
                      )}

                      <TableRow>
                        <TableCell colSpan={8} className="bg-muted/25">
                          <div className="grid grid-cols-1 gap-2 rounded-xl border border-dashed border-border/80 bg-background/80 p-2 md:grid-cols-[2fr_150px_160px_150px_150px_2fr_auto]">
                            <Input
                              value={getNewTaskDraft(segment.id).title}
                              onChange={(event) => updateNewTaskDraft(segment.id, "title", event.target.value)}
                              placeholder="Add parent task"
                            />
                            <Select
                              value={getNewTaskDraft(segment.id).owner}
                              onValueChange={(value) => updateNewTaskDraft(segment.id, "owner", value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ownerOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select
                              value={getNewTaskDraft(segment.id).status}
                              onValueChange={(value) => updateNewTaskDraft(segment.id, "status", value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {statusOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select
                              value={getNewTaskDraft(segment.id).priority}
                              onValueChange={(value) => updateNewTaskDraft(segment.id, "priority", value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {priorityOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="date"
                              value={getNewTaskDraft(segment.id).dueDate}
                              onChange={(event) => updateNewTaskDraft(segment.id, "dueDate", event.target.value)}
                            />
                            <Input
                              value={getNewTaskDraft(segment.id).notes}
                              onChange={(event) => updateNewTaskDraft(segment.id, "notes", event.target.value)}
                              placeholder="Notes"
                            />
                            <Button variant="secondary" onClick={() => createTask(segment.id)} disabled={loading}>
                              <Plus className="mr-2 h-4 w-4" />
                              Add Task
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          );
        })
      ) : (
        <CalendarShell title="Segmented Task List">
          <EmptyState message="No segments yet. Create your first segment above." />
        </CalendarShell>
      )}
    </div>
  );
}
