import { redirect } from "next/navigation";

import { SectionHeader } from "@/components/dashboard/section-header";
import { SegmentedTaskBoardClient } from "@/components/tasks/segmented-task-board-client";
import { resolveDashboardAccessLevel } from "@/lib/access-control";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { segmentedTaskListService } from "@/server/services";

export default async function SegmentedTaskListPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (resolveDashboardAccessLevel(user.email) !== "full") {
    redirect("/calendar");
  }

  const board = await segmentedTaskListService.getBoard();

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Segmented Task List"
        description="Monday-style grouped board with parent tasks and nested subtasks for Dylan, John, and Shampt19."
      />
      <SegmentedTaskBoardClient initialBoard={board} />
    </div>
  );
}
