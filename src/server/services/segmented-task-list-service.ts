import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { seededSegmentedTaskBoard } from "@/server/data/segmented-task-list";
import type {
  SegmentedSubtask,
  SegmentedTask,
  SegmentedTaskBoard,
  SegmentedTaskOwner,
  SegmentedTaskPriority,
  SegmentedTaskSegment,
  SegmentedTaskStatus
} from "@/types/segmented-task-list";

const integrationSecretKey = "segmented-task-list-board-v1";
let inMemoryBoard: SegmentedTaskBoard = structuredClone(seededSegmentedTaskBoard);

const ownerValues: SegmentedTaskOwner[] = ["dylan", "john", "shampt19", "unassigned"];
const statusValues: SegmentedTaskStatus[] = ["not-started", "in-progress", "blocked", "done"];
const priorityValues: SegmentedTaskPriority[] = ["low", "medium", "high", "critical"];

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function isOwner(value: unknown): value is SegmentedTaskOwner {
  return typeof value === "string" && ownerValues.includes(value as SegmentedTaskOwner);
}

function isStatus(value: unknown): value is SegmentedTaskStatus {
  return typeof value === "string" && statusValues.includes(value as SegmentedTaskStatus);
}

function isPriority(value: unknown): value is SegmentedTaskPriority {
  return typeof value === "string" && priorityValues.includes(value as SegmentedTaskPriority);
}

function normalizeHexColor(value: string) {
  const trimmed = value.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  return "#DBEAFE";
}

function parseBoardPayload(raw: string | null | undefined) {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as SegmentedTaskBoard;
    if (!parsed || !Array.isArray(parsed.segments)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function findSegment(board: SegmentedTaskBoard, segmentId: string) {
  const segment = board.segments.find((item) => item.id === segmentId);
  if (!segment) {
    throw new Error("Segment not found.");
  }
  return segment;
}

function findTask(segment: SegmentedTaskSegment, taskId: string) {
  const task = segment.tasks.find((item) => item.id === taskId);
  if (!task) {
    throw new Error("Task not found.");
  }
  return task;
}

async function loadBoardFromIntegrationSecrets() {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return null;
  }

  try {
    const { data, error } = await admin
      .from("integration_secrets")
      .select("value")
      .eq("key", integrationSecretKey)
      .maybeSingle();

    if (error) {
      return null;
    }

    const parsed = parseBoardPayload(data?.value);
    return parsed;
  } catch {
    return null;
  }
}

async function persistBoard(board: SegmentedTaskBoard) {
  inMemoryBoard = structuredClone(board);

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return;
  }

  try {
    await admin.from("integration_secrets").upsert(
      {
        key: integrationSecretKey,
        value: JSON.stringify(board)
      },
      { onConflict: "key" }
    );
  } catch {
    // Keep in-memory value when persistence is unavailable.
  }
}

type SegmentInput = {
  title: string;
  color?: string;
};

type TaskInput = {
  title: string;
  owner: SegmentedTaskOwner;
  status: SegmentedTaskStatus;
  priority: SegmentedTaskPriority;
  dueDate?: string | null;
  notes?: string | null;
};

type SubtaskInput = {
  title: string;
  owner: SegmentedTaskOwner;
  status: SegmentedTaskStatus;
};

function mutateTask(task: SegmentedTask, input: TaskInput) {
  task.title = input.title.trim();
  task.owner = isOwner(input.owner) ? input.owner : "unassigned";
  task.status = isStatus(input.status) ? input.status : "not-started";
  task.priority = isPriority(input.priority) ? input.priority : "medium";
  task.dueDate = input.dueDate && input.dueDate.trim() ? input.dueDate : null;
  task.notes = input.notes && input.notes.trim() ? input.notes.trim() : null;
  task.updatedAt = nowIso();
}

function mutateSubtask(subtask: SegmentedSubtask, input: SubtaskInput) {
  subtask.title = input.title.trim();
  subtask.owner = isOwner(input.owner) ? input.owner : "unassigned";
  subtask.status = isStatus(input.status) ? input.status : "not-started";
  subtask.updatedAt = nowIso();
}

export const segmentedTaskListService = {
  async getBoard() {
    const supabaseBoard = await loadBoardFromIntegrationSecrets();
    if (supabaseBoard) {
      inMemoryBoard = structuredClone(supabaseBoard);
      return supabaseBoard;
    }

    return structuredClone(inMemoryBoard);
  },

  async createSegment(input: SegmentInput) {
    const board = await this.getBoard();
    const title = input.title.trim();
    if (!title) {
      throw new Error("Segment title is required.");
    }

    const timestamp = nowIso();
    const nextSegment: SegmentedTaskSegment = {
      id: makeId("segment"),
      title,
      color: normalizeHexColor(input.color ?? "#DBEAFE"),
      createdAt: timestamp,
      updatedAt: timestamp,
      tasks: []
    };

    board.segments = [...board.segments, nextSegment];
    board.updatedAt = timestamp;
    await persistBoard(board);
    return board;
  },

  async updateSegment(segmentId: string, input: SegmentInput) {
    const board = await this.getBoard();
    const segment = findSegment(board, segmentId);
    const title = input.title.trim();
    if (!title) {
      throw new Error("Segment title is required.");
    }

    segment.title = title;
    if (input.color) {
      segment.color = normalizeHexColor(input.color);
    }
    segment.updatedAt = nowIso();
    board.updatedAt = segment.updatedAt;
    await persistBoard(board);
    return board;
  },

  async createTask(segmentId: string, input: TaskInput) {
    const board = await this.getBoard();
    const segment = findSegment(board, segmentId);
    const title = input.title.trim();
    if (!title) {
      throw new Error("Task title is required.");
    }

    const timestamp = nowIso();
    const task: SegmentedTask = {
      id: makeId("task"),
      title,
      owner: isOwner(input.owner) ? input.owner : "unassigned",
      status: isStatus(input.status) ? input.status : "not-started",
      priority: isPriority(input.priority) ? input.priority : "medium",
      dueDate: input.dueDate && input.dueDate.trim() ? input.dueDate : null,
      notes: input.notes && input.notes.trim() ? input.notes.trim() : null,
      createdAt: timestamp,
      updatedAt: timestamp,
      subtasks: []
    };

    segment.tasks = [...segment.tasks, task];
    segment.updatedAt = timestamp;
    board.updatedAt = timestamp;
    await persistBoard(board);
    return board;
  },

  async updateTask(segmentId: string, taskId: string, input: TaskInput) {
    const board = await this.getBoard();
    const segment = findSegment(board, segmentId);
    const task = findTask(segment, taskId);
    mutateTask(task, input);
    segment.updatedAt = task.updatedAt;
    board.updatedAt = task.updatedAt;
    await persistBoard(board);
    return board;
  },

  async deleteTask(segmentId: string, taskId: string) {
    const board = await this.getBoard();
    const segment = findSegment(board, segmentId);
    segment.tasks = segment.tasks.filter((task) => task.id !== taskId);
    const timestamp = nowIso();
    segment.updatedAt = timestamp;
    board.updatedAt = timestamp;
    await persistBoard(board);
    return board;
  },

  async createSubtask(segmentId: string, taskId: string, input: SubtaskInput) {
    const board = await this.getBoard();
    const segment = findSegment(board, segmentId);
    const task = findTask(segment, taskId);
    const title = input.title.trim();
    if (!title) {
      throw new Error("Subtask title is required.");
    }

    const timestamp = nowIso();
    task.subtasks = [
      ...task.subtasks,
      {
        id: makeId("subtask"),
        title,
        owner: isOwner(input.owner) ? input.owner : "unassigned",
        status: isStatus(input.status) ? input.status : "not-started",
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ];
    task.updatedAt = timestamp;
    segment.updatedAt = timestamp;
    board.updatedAt = timestamp;
    await persistBoard(board);
    return board;
  },

  async updateSubtask(segmentId: string, taskId: string, subtaskId: string, input: SubtaskInput) {
    const board = await this.getBoard();
    const segment = findSegment(board, segmentId);
    const task = findTask(segment, taskId);
    const subtask = task.subtasks.find((item) => item.id === subtaskId);
    if (!subtask) {
      throw new Error("Subtask not found.");
    }

    mutateSubtask(subtask, input);
    task.updatedAt = subtask.updatedAt;
    segment.updatedAt = subtask.updatedAt;
    board.updatedAt = subtask.updatedAt;
    await persistBoard(board);
    return board;
  },

  async deleteSubtask(segmentId: string, taskId: string, subtaskId: string) {
    const board = await this.getBoard();
    const segment = findSegment(board, segmentId);
    const task = findTask(segment, taskId);
    task.subtasks = task.subtasks.filter((item) => item.id !== subtaskId);
    const timestamp = nowIso();
    task.updatedAt = timestamp;
    segment.updatedAt = timestamp;
    board.updatedAt = timestamp;
    await persistBoard(board);
    return board;
  }
};
