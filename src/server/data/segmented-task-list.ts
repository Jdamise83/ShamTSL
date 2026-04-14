import type { SegmentedTaskBoard } from "@/types/segmented-task-list";

const now = new Date().toISOString();

export const seededSegmentedTaskBoard: SegmentedTaskBoard = {
  updatedAt: now,
  segments: [
    {
      id: "segment-growth",
      title: "Growth Sprint",
      color: "#DBEAFE",
      createdAt: now,
      updatedAt: now,
      tasks: [
        {
          id: "task-growth-march",
          title: "Q2 Offer Rollout",
          owner: "dylan",
          status: "in-progress",
          priority: "high",
          dueDate: new Date(new Date().setDate(new Date().getDate() + 10)).toISOString().slice(0, 10),
          notes: "Align landing pages + paid creative before launch.",
          createdAt: now,
          updatedAt: now,
          subtasks: [
            {
              id: "subtask-growth-copy",
              title: "Finalize copy blocks",
              owner: "john",
              status: "in-progress",
              createdAt: now,
              updatedAt: now
            }
          ]
        }
      ]
    },
    {
      id: "segment-operations",
      title: "Operations",
      color: "#DCFCE7",
      createdAt: now,
      updatedAt: now,
      tasks: []
    }
  ]
};
