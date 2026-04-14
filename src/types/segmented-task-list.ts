export type SegmentedTaskOwner = "dylan" | "john" | "shampt19" | "unassigned";
export type SegmentedTaskStatus = "not-started" | "in-progress" | "blocked" | "done";
export type SegmentedTaskPriority = "low" | "medium" | "high" | "critical";

export interface SegmentedSubtask {
  id: string;
  title: string;
  owner: SegmentedTaskOwner;
  status: SegmentedTaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SegmentedTask {
  id: string;
  title: string;
  owner: SegmentedTaskOwner;
  status: SegmentedTaskStatus;
  priority: SegmentedTaskPriority;
  dueDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  subtasks: SegmentedSubtask[];
}

export interface SegmentedTaskSegment {
  id: string;
  title: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  tasks: SegmentedTask[];
}

export interface SegmentedTaskBoard {
  segments: SegmentedTaskSegment[];
  updatedAt: string;
}
