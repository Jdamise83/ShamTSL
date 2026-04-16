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
const fallbackStorageTitle = "[[SEGMENTED_TASK_BOARD]]";
const fallbackStorageLocation = "tsl://segmented-task-list/storage";
const fallbackStorageTimestamp = "2000-01-01T00:00:00.000Z";
let inMemoryBoard: SegmentedTaskBoard = structuredClone(seededSegmentedTaskBoard);
let hasLoadedDurableBoard = false;
let lastPersistenceWarning: string | null = null;
let activePersistenceBackend: "integration_secrets" | "calendar_events" | "memory" = "memory";
const legacySeedSegments = new Map<string, string>([
  ["segment-growth", "growth sprint"],
  ["segment-operations", "operations"]
]);

const ownerValues: SegmentedTaskOwner[] = ["dylan", "john", "shampt19", "unassigned"];
const statusValues: SegmentedTaskStatus[] = ["not-started", "in-progress", "blocked", "done"];
const priorityValues: SegmentedTaskPriority[] = ["low", "medium", "high", "critical"];

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function normalizeLabel(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown Supabase error.";
}

function isMissingIntegrationSecretsTableError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("could not find the table 'public.integration_secrets'") ||
    normalized.includes('relation "integration_secrets" does not exist')
  );
}

function setWarning(message: string | null) {
  lastPersistenceWarning = message;
}

export class TaskBoardPersistenceError extends Error {
  readonly board: SegmentedTaskBoard;

  constructor(message: string, board: SegmentedTaskBoard) {
    super(message);
    this.name = "TaskBoardPersistenceError";
    this.board = structuredClone(board);
  }
}

function isPersistenceConfigured() {
  return createSupabaseAdminClient() !== null;
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

type BoardLoadResult =
  | { state: "not-found" }
  | { state: "ok"; board: SegmentedTaskBoard }
  | { state: "error"; message: string };

type SupabaseAdminClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

async function loadBoardFromIntegrationSecrets(admin: SupabaseAdminClient): Promise<BoardLoadResult> {
  try {
    const { data, error } = await admin
      .from("integration_secrets")
      .select("value")
      .eq("key", integrationSecretKey)
      .maybeSingle();

    if (error) {
      return { state: "error", message: error.message };
    }

    if (!data?.value) {
      return { state: "not-found" };
    }

    const parsed = parseBoardPayload(data.value);
    if (!parsed) {
      return {
        state: "error",
        message: "Stored task board payload is invalid JSON."
      };
    }

    return { state: "ok", board: parsed };
  } catch (error) {
    return { state: "error", message: getErrorMessage(error) };
  }
}

async function loadBoardFromCalendarEventFallback(admin: SupabaseAdminClient): Promise<BoardLoadResult> {
  try {
    const { data, error } = await admin
      .from("calendar_events")
      .select("internal_notes,updated_at")
      .eq("title", fallbackStorageTitle)
      .eq("location", fallbackStorageLocation)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error) {
      return { state: "error", message: error.message };
    }

    const row = data?.[0];
    if (!row?.internal_notes) {
      return { state: "not-found" };
    }

    const parsed = parseBoardPayload(row.internal_notes);
    if (!parsed) {
      return {
        state: "error",
        message: "Stored task board payload in calendar_events is invalid JSON."
      };
    }

    return { state: "ok", board: parsed };
  } catch (error) {
    return { state: "error", message: getErrorMessage(error) };
  }
}

async function persistToIntegrationSecrets(admin: SupabaseAdminClient, board: SegmentedTaskBoard) {
  const { error } = await admin.from("integration_secrets").upsert(
    {
      key: integrationSecretKey,
      value: JSON.stringify(board)
    },
    { onConflict: "key" }
  );

  if (error) {
    throw new Error(error.message);
  }
}

async function persistToCalendarEventFallback(admin: SupabaseAdminClient, board: SegmentedTaskBoard) {
  const payload = JSON.stringify(board);

  const { data: existingRows, error: readError } = await admin
    .from("calendar_events")
    .select("id")
    .eq("title", fallbackStorageTitle)
    .eq("location", fallbackStorageLocation)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (readError) {
    throw new Error(readError.message);
  }

  const existingId = existingRows?.[0]?.id;
  if (existingId) {
    const { error: updateError } = await admin
      .from("calendar_events")
      .update({
        internal_notes: payload,
        updated_at: nowIso()
      })
      .eq("id", existingId);

    if (updateError) {
      throw new Error(updateError.message);
    }
    return;
  }

  const { error: insertError } = await admin.from("calendar_events").insert({
    title: fallbackStorageTitle,
    description: "Internal segmented task board storage",
    location: fallbackStorageLocation,
    meeting_link: null,
    internal_notes: payload,
    status: "cancelled",
    starts_at: fallbackStorageTimestamp,
    ends_at: fallbackStorageTimestamp,
    created_by: null
  });

  if (insertError) {
    throw new Error(insertError.message);
  }
}

async function persistBoard(board: SegmentedTaskBoard, requireDurable = isPersistenceConfigured()) {
  const nextBoard = structuredClone(board);
  inMemoryBoard = nextBoard;

  const admin = createSupabaseAdminClient();
  if (!admin) {
    activePersistenceBackend = "memory";
    setWarning("Task board is running in local memory mode. Save will reset on redeploy.");
    if (requireDurable) {
      throw new TaskBoardPersistenceError(
        "Task board persistence is not configured. Add SUPABASE_SERVICE_ROLE_KEY in Vercel to prevent data loss.",
        nextBoard
      );
    }
    return;
  }

  try {
    if (activePersistenceBackend === "calendar_events") {
      await persistToCalendarEventFallback(admin, nextBoard);
      hasLoadedDurableBoard = true;
      setWarning("Using calendar-backed storage for task board sync.");
      return;
    }

    await persistToIntegrationSecrets(admin, nextBoard);
    activePersistenceBackend = "integration_secrets";
    hasLoadedDurableBoard = true;
    setWarning(null);
    return;
  } catch (error) {
    const detail = getErrorMessage(error);

    if (isMissingIntegrationSecretsTableError(detail)) {
      try {
        await persistToCalendarEventFallback(admin, nextBoard);
        activePersistenceBackend = "calendar_events";
        hasLoadedDurableBoard = true;
        setWarning("Using calendar-backed storage because integration_secrets is unavailable.");
        return;
      } catch (fallbackError) {
        const fallbackDetail = getErrorMessage(fallbackError);
        setWarning(`Supabase sync warning: ${fallbackDetail}`);
        if (requireDurable) {
          throw new TaskBoardPersistenceError(
            `Failed to persist task board to Supabase. ${fallbackDetail}`,
            nextBoard
          );
        }
        return;
      }
    }

    setWarning(`Supabase sync warning: ${detail}`);
    if (requireDurable) {
      throw new TaskBoardPersistenceError(
        `Failed to persist task board to Supabase. ${detail}`,
        nextBoard
      );
    }
  }
}

function removeLegacySeedSegments(board: SegmentedTaskBoard) {
  const segments = board.segments.filter((segment) => {
    const legacyTitle = legacySeedSegments.get(segment.id);
    if (!legacyTitle) {
      return true;
    }

    return normalizeLabel(segment.title) !== normalizeLabel(legacyTitle);
  });

  if (segments.length === board.segments.length) {
    return { board, changed: false };
  }

  return {
    board: {
      ...board,
      segments,
      updatedAt: nowIso()
    },
    changed: true
  };
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
  getPersistenceStatus() {
    return {
      durable: activePersistenceBackend !== "memory",
      mode: activePersistenceBackend === "memory" ? "memory" : "supabase",
      backend: activePersistenceBackend,
      warning: lastPersistenceWarning
    } as const;
  },

  async getBoard() {
    const admin = createSupabaseAdminClient();
    if (!admin) {
      activePersistenceBackend = "memory";
      setWarning("Task board is running in local memory mode. Save will reset on redeploy.");
      const cleaned = removeLegacySeedSegments(inMemoryBoard);
      inMemoryBoard = structuredClone(cleaned.board);
      return structuredClone(cleaned.board);
    }

    const loadFromFallback = async () => {
      const fallbackResult = await loadBoardFromCalendarEventFallback(admin);
      if (fallbackResult.state === "ok") {
        activePersistenceBackend = "calendar_events";
        hasLoadedDurableBoard = true;
        setWarning("Using calendar-backed storage because integration_secrets is unavailable.");
        const cleaned = removeLegacySeedSegments(fallbackResult.board);
        inMemoryBoard = structuredClone(cleaned.board);
        if (cleaned.changed) {
          await persistBoard(cleaned.board, false);
        }
        return structuredClone(cleaned.board);
      }

      if (fallbackResult.state === "error") {
        activePersistenceBackend = "memory";
        setWarning(`Supabase sync warning: ${fallbackResult.message}`);
      } else {
        activePersistenceBackend = "calendar_events";
        setWarning("Using calendar-backed storage because integration_secrets is unavailable.");
      }

      const cleaned = removeLegacySeedSegments(inMemoryBoard);
      inMemoryBoard = structuredClone(cleaned.board);
      try {
        await persistToCalendarEventFallback(admin, cleaned.board);
        hasLoadedDurableBoard = true;
      } catch (error) {
        activePersistenceBackend = "memory";
        setWarning(`Supabase sync warning: ${getErrorMessage(error)}`);
      }
      return structuredClone(cleaned.board);
    };

    const loadResult = await loadBoardFromIntegrationSecrets(admin);
    if (loadResult.state === "ok") {
      activePersistenceBackend = "integration_secrets";
      hasLoadedDurableBoard = true;
      setWarning(null);
      const cleaned = removeLegacySeedSegments(loadResult.board);
      inMemoryBoard = structuredClone(cleaned.board);
      if (cleaned.changed) {
        await persistBoard(cleaned.board, false);
      }
      return structuredClone(cleaned.board);
    }

    if (loadResult.state === "error") {
      if (isMissingIntegrationSecretsTableError(loadResult.message)) {
        return loadFromFallback();
      }

      if (hasLoadedDurableBoard) {
        setWarning(`Supabase sync warning: ${loadResult.message}`);
        return structuredClone(inMemoryBoard);
      }

      activePersistenceBackend = "memory";
      setWarning(`Supabase sync warning: ${loadResult.message}`);
      const cleaned = removeLegacySeedSegments(inMemoryBoard);
      inMemoryBoard = structuredClone(cleaned.board);
      return structuredClone(cleaned.board);
    }

    // integration_secrets table exists but key row not yet created: seed it.
    activePersistenceBackend = "integration_secrets";
    setWarning(null);

    const cleaned = removeLegacySeedSegments(inMemoryBoard);
    inMemoryBoard = structuredClone(cleaned.board);

    try {
      await persistBoard(cleaned.board, false);
    } catch {
      // Ignore initial seed persistence failures; board remains available.
    }

    return structuredClone(cleaned.board);
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

  async deleteSegment(segmentId: string) {
    const board = await this.getBoard();
    const segment = findSegment(board, segmentId);
    board.segments = board.segments.filter((item) => item.id !== segment.id);
    const timestamp = nowIso();
    board.updatedAt = timestamp;
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
