"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function OrgError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title="This page failed to load"
      description={error.digest ? `Reference: ${error.digest}` : "Please try again."}
      action={<Button onClick={reset}>Try again</Button>}
      className="mt-10"
    />
  );
}
