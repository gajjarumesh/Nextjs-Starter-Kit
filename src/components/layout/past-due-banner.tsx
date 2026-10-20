import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export function PastDueBanner({ orgSlug, canManage }: { orgSlug: string; canManage: boolean }) {
  return (
    <div className="border-warning/40 bg-warning/15 flex flex-wrap items-center justify-center gap-2 border-b px-4 py-2 text-sm">
      <AlertTriangle className="text-warning size-4" />
      <span>Your last payment failed. We&apos;ll retry automatically.</span>
      {canManage ? (
        <Link
          href={`/${orgSlug}/settings/billing`}
          className="text-primary font-medium underline-offset-4 hover:underline"
        >
          Update billing
        </Link>
      ) : (
        <span className="text-muted-foreground">Ask an Owner to update billing.</span>
      )}
    </div>
  );
}
