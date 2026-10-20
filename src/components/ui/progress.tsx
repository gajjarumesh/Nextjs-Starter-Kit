import { cn } from "@/lib/utils";

export function Progress({
  value,
  className,
  indicatorClassName,
  label,
}: {
  value: number;
  className?: string;
  indicatorClassName?: string;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label}
      className={cn("bg-secondary relative h-2 w-full overflow-hidden rounded-full", className)}
    >
      <div
        className={cn("bg-primary h-full rounded-full transition-all", indicatorClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
