import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Pager({
  basePath,
  params,
  page,
  pageSize,
  total,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  pageSize: number;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const sp = new URLSearchParams(
      Object.entries(params).filter((e): e is [string, string] => Boolean(e[1])),
    );
    sp.set("page", String(p));
    return `${basePath}?${sp}`;
  };
  return (
    <div className="text-muted-foreground flex items-center justify-between text-sm">
      <span>{total} total</span>
      <div className="flex items-center gap-2">
        <span>
          Page {page} of {pages}
        </span>
        <Button
          asChild
          variant="outline"
          size="icon-sm"
          aria-disabled={page <= 1}
          className={page <= 1 ? "pointer-events-none opacity-50" : ""}
        >
          <Link href={href(page - 1)} aria-label="Previous page">
            <ChevronLeft />
          </Link>
        </Button>
        <Button
          asChild
          variant="outline"
          size="icon-sm"
          aria-disabled={page >= pages}
          className={page >= pages ? "pointer-events-none opacity-50" : ""}
        >
          <Link href={href(page + 1)} aria-label="Next page">
            <ChevronRight />
          </Link>
        </Button>
      </div>
    </div>
  );
}
