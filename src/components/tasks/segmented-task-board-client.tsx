"use client";

import { useMemo, useState } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";

import { CalendarShell } from "@/components/calendar/calendar-shell";
import { EmptyState } from "@/components/dashboard/empty-state";
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
import type {
  SegmentedTask,
  SegmentedTaskBoard,
  SegmentedTaskOwner,
  SegmentedTaskStatus
} from "@/types/segmented-task-list";

interface SegmentedTaskBoardClientProps {
  initialBoard: SegmentedTaskBoard;
}

interface TaskCreateDraft {
  title: string;
  owner: SegmentedTaskOwner;
}

type BoardStatus = "not-started" | "in-progress" | "done";

const ownerOptions: Array<{ value: SegmentedTaskOwner; label: string; color: string }> = [
  { value: "shampt19", label: "Shampt19", color: "#7C3AED" },
  { value: "john", label: "John", color: "#0EA5A3" },
  { value: "dylan", label: "Dylan", color: "#2F74FF" },
  { value: "unassigned", label: "Unassigned", color: "#64748B" }
];

const flatColorOptions = [
  { name: "Sky Blue", value: "#DBEAFE" },
  { name: "Mint Green", value: "#DCFCE7" },
  { name: "Soft Pink", value: "#FCE7F3" },
  { name: "Sun Yellow", value: "#FEF3C7" },
  { name: "Lavender", value: "#E0E7FF" },
  { name: "Coral", value: "#FEE2E2" },
  { name: "Teal", value: "#CCFBF1" },
  { name: "Orange", value: "#FFEDD5" },
  { name: "Slate", value: "#E2E8F0" },
  { name: "Lilac", value: "#EDE9FE" }
];

const columns: Array<{ key: BoardStatus; label: string }> = [
  { key: "not-started", label: "To Do" },
  { key: "in-progress", label: "Initiated" },
  { key: "done", label: "Completed" }
];

function normalizeStatus(status: SegmentedTaskStatus): BoardStatus {
  if (status === "blocked") {
    return "in-progress";
  }
  if (status === "done") {
    return "done";
  }
  if (status === "in-progress") {
    return "in-progress";
  }
  return "not-started";
}

function ownerMeta(owner: SegmentedTaskOwner) {
  return ownerOptions.find((option) => option.value === owner) ?? ownerOptions[3];
}

function getInitialDraftForSegment(segmentId: string, drafts: Record<string, TaskCreateDraft>) {
  return drafts[segmentId] ?? { title: "", owner: "unassigned" };
}

export function SegmentedTaskBoardClient({ initialBoard }: SegmentedTaskBoardClientProps) {
  const [board, setBoard] = useState(initialBoard);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [taskTitleInput, setTaskTitleInput] = useState("");
  const [taskColorInput, setTaskColorInput] = useState(flatColorOptions[0].value);
  const [taskDraftsByGroup, setTaskDraftsByGroup] = useState<Record<string, TaskCreateDraft>>({});

  const [draggingTask, setDraggingTask] = useState<{ segmentId: string; taskId: string } | null>(null);

  const taskCount = useMemo(
    () => board.segments.reduce((total, segment) => total + segment.tasks.length, 0),
    [board]
  );

  async function postAction(body: object) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/segmented-task-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Task board action failed.");
      }

      const payload = (await response.json()) as { board: SegmentedTaskBoard };
      setBoard(payload.board);
      return payload.board;
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Task board action failed.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function createMainTask() {
    const title = taskTitleInput.trim();
    if (!title) {
      setError("Task title is required.");
      return;
    }

    const next = await postAction({
      action: "create-segment",
      payload: {
        title,
        color: taskColorInput
      }
    });

    if (next) {
      setTaskTitleInput("");
      setTaskColorInput(flatColorOptions[0].value);
    }
  }

  async function createTaskItem(segmentId: string) {
    const draft = getInitialDraftForSegment(segmentId, taskDraftsByGroup);
    if (!draft.title.trim()) {
      setError("Task item title is required.");
      return;
    }

    const next = await postAction({
      action: "create-task",
      payload: {
        segmentId,
        task: {
          title: draft.title.trim(),
          owner: draft.owner,
          status: "not-started",
          priority: "medium",
          dueDate: null,
          notes: null
        }
      }
    });

    if (next) {
      setTaskDraftsByGroup((previous) => ({
        ...previous,
        [segmentId]: { title: "", owner: "unassigned" }
      }));
    }
  }

  async function removeTaskItem(segmentId: string, taskId: string) {
    await postAction({
      action: "delete-task",
      payload: { segmentId, taskId }
    });
  }

  async function moveTaskItem(
    segmentId: string,
    taskId: string,
    targetStatus: BoardStatus
  ) {
    const segment = board.segments.find((item) => item.id === segmentId);
    const task = segment?.tasks.find((item) => item.id === taskId);
    if (!task) {
      return;
    }

    if (normalizeStatus(task.status) === targetStatus) {
      return;
    }

    await postAction({
      action: "update-task",
      payload: {
        segmentId,
        taskId,
        task: {
          title: task.title,
          owner: task.owner,
          status: targetStatus,
          priority: task.priority,
          dueDate: task.dueDate,
          notes: task.notes
        }
      }
    });
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border-border/80 bg-card">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Main Tasks</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{board.segments.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/80 bg-card">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Total Task Items</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{taskCount}</p>
          </CardContent>
        </Card>
      </div>

      <CalendarShell title="Create Main Task" subtitle="Then drag task items between To Do, Initiated, and Completed.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_190px_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="main-task-title">Task</Label>
            <Input
              id="main-task-title"
              value={taskTitleInput}
              onChange={(event) => setTaskTitleInput(event.target.value)}
              placeholder="Example: Q2 Product Launch"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="main-task-colour">Colour</Label>
            <Select value={taskColorInput} onValueChange={setTaskColorInput}>
              <SelectTrigger id="main-task-colour">
                <SelectValue placeholder="Choose colour" />
              </SelectTrigger>
              <SelectContent>
                {flatColorOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={createMainTask} disabled={loading} className="w-full md:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Add Task
            </Button>
          </div>
        </div>
      </CalendarShell>

      {board.segments.length ? (
        board.segments.map((segment) => {
          const draft = getInitialDraftForSegment(segment.id, taskDraftsByGroup);
          const tasksByStatus: Record<BoardStatus, SegmentedTask[]> = {
            "not-started": segment.tasks.filter((task) => normalizeStatus(task.status) === "not-started"),
            "in-progress": segment.tasks.filter((task) => normalizeStatus(task.status) === "in-progress"),
            done: segment.tasks.filter((task) => normalizeStatus(task.status) === "done")
          };

          return (
            <Card
              key={segment.id}
              className="overflow-hidden border-border/80 bg-card"
              style={{ borderLeft: `6px solid ${segment.color}` }}
            >
              <CardHeader className="border-b border-border/60 bg-muted/25 pb-4">
                <CardTitle className="text-base uppercase tracking-[0.08em]">
                  Task: {segment.title}
                </CardTitle>

                <div className="grid grid-cols-1 gap-2 md:grid-cols-[2fr_170px_auto]">
                  <Input
                    value={draft.title}
                    onChange={(event) =>
                      setTaskDraftsByGroup((previous) => ({
                        ...previous,
                        [segment.id]: { ...draft, title: event.target.value }
                      }))
                    }
                    placeholder="Add task item"
                  />
                  <Select
                    value={draft.owner}
                    onValueChange={(value) =>
                      setTaskDraftsByGroup((previous) => ({
                        ...previous,
                        [segment.id]: { ...draft, owner: value as SegmentedTaskOwner }
                      }))
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
                  <Button variant="secondary" onClick={() => createTaskItem(segment.id)} disabled={loading}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Item
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-4">
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                  {columns.map((column) => (
                    <div
                      key={column.key}
                      className="rounded-2xl border border-border/70 bg-muted/20 p-3"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={async (event) => {
                        event.preventDefault();
                        let payload: { segmentId: string; taskId: string } | null = draggingTask;
                        try {
                          const transferred = event.dataTransfer.getData("application/json");
                          if (transferred) {
                            payload = JSON.parse(transferred) as { segmentId: string; taskId: string };
                          }
                        } catch {
                          payload = draggingTask;
                        }

                        if (!payload || payload.segmentId !== segment.id) {
                          return;
                        }

                        await moveTaskItem(payload.segmentId, payload.taskId, column.key);
                        setDraggingTask(null);
                      }}
                    >
                      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        {column.label} ({tasksByStatus[column.key].length})
                      </p>

                      <div className="space-y-2">
                        {tasksByStatus[column.key].length ? (
                          tasksByStatus[column.key].map((task) => {
                            const owner = ownerMeta(task.owner);
                            return (
                              <div
                                key={task.id}
                                draggable
                                onDragStart={(event) => {
                                  const payload = JSON.stringify({ segmentId: segment.id, taskId: task.id });
                                  event.dataTransfer.setData("application/json", payload);
                                  setDraggingTask({ segmentId: segment.id, taskId: task.id });
                                }}
                                onDragEnd={() => setDraggingTask(null)}
                                className="rounded-xl border border-border/70 bg-background p-3 shadow-sm"
                                style={{ borderLeft: `5px solid ${owner.color}` }}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex min-w-0 items-start gap-2">
                                    <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                    <p className="text-sm font-semibold text-foreground">{task.title}</p>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 text-danger"
                                    onClick={() => removeTaskItem(segment.id, task.id)}
                                    disabled={loading}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>

                                <div className="mt-2 flex items-center gap-2">
                                  <span
                                    className="rounded-full px-2.5 py-1 text-xs font-semibold text-white"
                                    style={{ backgroundColor: owner.color }}
                                  >
                                    {owner.label}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="rounded-xl border border-dashed border-border/70 bg-background/70 p-3 text-xs text-muted-foreground">
                            Drop task items here.
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })
      ) : (
        <CalendarShell title="Segmented Task List">
          <EmptyState message="No main tasks yet. Create your first task above." />
        </CalendarShell>
      )}
    </div>
  );
}
