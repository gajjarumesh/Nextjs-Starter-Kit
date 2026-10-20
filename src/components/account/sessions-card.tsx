"use client";

import { Laptop, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteAccount, revokeOtherSessions, revokeSession } from "@/actions/account";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAction } from "@/components/use-action";
import { timeAgo } from "@/lib/format";

type SessionRow = {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  updatedAt: string;
  current: boolean;
};

function describe(ua: string | null) {
  if (!ua) return { label: "Unknown device", mobile: false };
  const mobile = /mobile|iphone|android/i.test(ua);
  const browser = /edg\//i.test(ua)
    ? "Edge"
    : /chrome\//i.test(ua)
      ? "Chrome"
      : /firefox\//i.test(ua)
        ? "Firefox"
        : /safari\//i.test(ua)
          ? "Safari"
          : "Browser";
  const os = /windows/i.test(ua)
    ? "Windows"
    : /mac os/i.test(ua)
      ? "macOS"
      : /android/i.test(ua)
        ? "Android"
        : /iphone|ipad/i.test(ua)
          ? "iOS"
          : /linux/i.test(ua)
            ? "Linux"
            : "";
  return { label: [browser, os].filter(Boolean).join(" on "), mobile };
}

export function SessionsCard({
  sessions,
  readOnly,
}: {
  sessions: SessionRow[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const revoke = useAction(revokeSession);
  const revokeOthers = useAction(revokeOtherSessions);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Active sessions</CardTitle>
        <CardDescription>Sessions expire after 7 days of inactivity.</CardDescription>
        {sessions.length > 1 && !readOnly ? (
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              loading={revokeOthers.pending}
              onClick={async () => {
                const res = await revokeOthers.run();
                if (res.ok) {
                  toast.success(`Signed out ${res.data.count} other session(s)`);
                  router.refresh();
                }
              }}
            >
              Sign out others
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {sessions.map((s) => {
            const d = describe(s.userAgent);
            return (
              <li key={s.id} className="flex items-center gap-3 py-3 text-sm">
                {d.mobile ? (
                  <Smartphone className="text-muted-foreground size-5" />
                ) : (
                  <Laptop className="text-muted-foreground size-5" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {d.label}{" "}
                    {s.current ? (
                      <Badge variant="success" className="ml-1">
                        This device
                      </Badge>
                    ) : null}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {s.ipAddress ?? "Unknown IP"} · active {timeAgo(s.updatedAt)}
                  </p>
                </div>
                {!s.current && !readOnly ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      const res = await revoke.run(s.id);
                      if (res.ok) router.refresh();
                    }}
                  >
                    Revoke
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

export function DeleteAccountCard({ email, readOnly }: { email: string; readOnly: boolean }) {
  const router = useRouter();
  const del = useAction(deleteAccount);
  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">Delete account</CardTitle>
        <CardDescription>
          Permanently delete your account and personal data. Organizations you own must have another
          Owner first.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ConfirmDialog
          title="Delete your account?"
          description="This permanently deletes your account and removes you from every organization."
          confirmLabel="Delete my account"
          requireText={email}
          onConfirm={async () => {
            const res = await del.run();
            if (res.ok) {
              router.push("/");
              router.refresh();
            }
            return res.ok;
          }}
          trigger={
            <Button variant="destructive" disabled={readOnly}>
              Delete account
            </Button>
          }
        />
      </CardContent>
    </Card>
  );
}
