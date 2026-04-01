"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/dashboard/error-state";
import { Button } from "@/components/ui/button";

export default function ProtectedError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="space-y-4">
      <ErrorState title="Dashboard Error" message={error.message || "Unexpected error while loading data."} />
      <Button onClick={reset}>Try Again</Button>
    </div>
  );
}
