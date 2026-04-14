import { Skeleton } from "@/components/ui/skeleton";

export default function SegmentedTaskListLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-[420px] w-full rounded-2xl" />
    </div>
  );
}
