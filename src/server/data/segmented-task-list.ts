import type { SegmentedTaskBoard } from "@/types/segmented-task-list";

const now = new Date().toISOString();

export const seededSegmentedTaskBoard: SegmentedTaskBoard = {
  updatedAt: now,
  segments: []
};
