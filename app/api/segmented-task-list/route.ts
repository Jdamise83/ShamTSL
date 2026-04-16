import { NextRequest, NextResponse } from "next/server";

import { resolveDashboardAccessLevel } from "@/lib/access-control";
import { hasSupabaseBrowserConfig } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { segmentedTaskListService } from "@/server/services";
import type {
  SegmentedTaskOwner,
  SegmentedTaskPriority,
  SegmentedTaskStatus
} from "@/types/segmented-task-list";

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

type ActionPayload =
  | { action: "create-segment"; payload: SegmentInput }
  | { action: "update-segment"; payload: { segmentId: string } & SegmentInput }
  | { action: "delete-segment"; payload: { segmentId: string } }
  | { action: "create-task"; payload: { segmentId: string; task: TaskInput } }
  | { action: "update-task"; payload: { segmentId: string; taskId: string; task: TaskInput } }
  | { action: "delete-task"; payload: { segmentId: string; taskId: string } }
  | {
      action: "create-subtask";
      payload: { segmentId: string; taskId: string; subtask: SubtaskInput };
    }
  | {
      action: "update-subtask";
      payload: { segmentId: string; taskId: string; subtaskId: string; subtask: SubtaskInput };
    }
  | {
      action: "delete-subtask";
      payload: { segmentId: string; taskId: string; subtaskId: string };
    };

async function ensureFullAccessUser() {
  if (!hasSupabaseBrowserConfig()) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  if (resolveDashboardAccessLevel(user.email) !== "full") {
    return null;
  }

  return user;
}

export async function GET() {
  const user = await ensureFullAccessUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const board = await segmentedTaskListService.getBoard();
  return NextResponse.json({ board, persistence: segmentedTaskListService.getPersistenceStatus() });
}

export async function POST(request: NextRequest) {
  const user = await ensureFullAccessUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as ActionPayload;

  try {
    if (body.action === "create-segment") {
      const board = await segmentedTaskListService.createSegment(body.payload);
      return NextResponse.json({ board });
    }

    if (body.action === "update-segment") {
      const board = await segmentedTaskListService.updateSegment(body.payload.segmentId, body.payload);
      return NextResponse.json({ board });
    }

    if (body.action === "delete-segment") {
      const board = await segmentedTaskListService.deleteSegment(body.payload.segmentId);
      return NextResponse.json({ board });
    }

    if (body.action === "create-task") {
      const board = await segmentedTaskListService.createTask(body.payload.segmentId, body.payload.task);
      return NextResponse.json({ board });
    }

    if (body.action === "update-task") {
      const board = await segmentedTaskListService.updateTask(
        body.payload.segmentId,
        body.payload.taskId,
        body.payload.task
      );
      return NextResponse.json({ board });
    }

    if (body.action === "delete-task") {
      const board = await segmentedTaskListService.deleteTask(body.payload.segmentId, body.payload.taskId);
      return NextResponse.json({ board });
    }

    if (body.action === "create-subtask") {
      const board = await segmentedTaskListService.createSubtask(
        body.payload.segmentId,
        body.payload.taskId,
        body.payload.subtask
      );
      return NextResponse.json({ board });
    }

    if (body.action === "update-subtask") {
      const board = await segmentedTaskListService.updateSubtask(
        body.payload.segmentId,
        body.payload.taskId,
        body.payload.subtaskId,
        body.payload.subtask
      );
      return NextResponse.json({ board });
    }

    if (body.action === "delete-subtask") {
      const board = await segmentedTaskListService.deleteSubtask(
        body.payload.segmentId,
        body.payload.taskId,
        body.payload.subtaskId
      );
      return NextResponse.json({ board });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Segmented task action failed." },
      { status: 400 }
    );
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
