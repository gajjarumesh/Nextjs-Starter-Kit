"use client";

import { Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { stopImpersonation } from "@/actions/admin";
import { Button } from "@/components/ui/button";

/** Shown on every page while a super admin is impersonating (read-only, time-limited). */
export function ImpersonationBanner({ email, expiresAt }: { email: string; expiresAt: number }) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const minutes = Math.max(0, Math.ceil((expiresAt - now) / 60_000));
  return (
    <div className="bg-warning text-warning-foreground sticky top-0 z-40 flex flex-wrap items-center justify-center gap-3 px-4 py-2 text-sm font-medium">
      <Eye className="size-4" />
      <span>
        Viewing as <strong>{email}</strong> (read-only) · {minutes} min left
      </span>
      <Button
        size="sm"
        variant="outline"
        loading={pending}
        className="border-warning-foreground/30 hover:bg-warning-foreground/10 h-7 bg-transparent"
        onClick={async () => {
          setPending(true);
          await stopImpersonation();
          router.push("/admin/users");
          router.refresh();
        }}
      >
        Stop impersonating
      </Button>
    </div>
  );
}
