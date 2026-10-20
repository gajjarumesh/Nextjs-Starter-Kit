import { Progress } from "@/components/ui/progress";
import { formatCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Tokens used against the plan limit. Warns at 80%, blocks at 100% (server-side). */
export function UsageMeter({
  used,
  limit,
  compact,
  className,
}: {
  used: number;
  limit: number;
  compact?: boolean;
  className?: string;
}) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;
  const tone = pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-warning" : "bg-primary";
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted-foreground font-medium">
          {compact ? "AI tokens" : "AI tokens this period"}
        </span>
        <span className="tabular-nums">
          <span className="text-foreground font-semibold">{formatCompact(used)}</span>
          <span className="text-muted-foreground"> / {formatCompact(limit)}</span>
        </span>
      </div>
      <Progress
        value={pct}
        indicatorClassName={tone}
        className={compact ? "h-1.5" : undefined}
        label="AI token usage"
      />
    </div>
  );
}
