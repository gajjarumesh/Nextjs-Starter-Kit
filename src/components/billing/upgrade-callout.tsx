import { ArrowUpRight, Zap } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function UpgradeCallout({
  orgSlug,
  title = "Upgrade for more",
  description,
  className,
}: {
  orgSlug: string;
  title?: string;
  description: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-primary/25 from-primary/10 via-primary/5 relative flex flex-col gap-3 overflow-hidden rounded-xl border bg-gradient-to-br to-transparent p-5 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex gap-3">
        <div className="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
          <Zap className="size-4" />
        </div>
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
      </div>
      <Button asChild size="sm">
        <Link href={`/${orgSlug}/settings/billing`}>
          View plans <ArrowUpRight />
        </Link>
      </Button>
    </div>
  );
}
