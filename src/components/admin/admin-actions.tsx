"use client";

import { Eye, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { replayWebhook, setPlanOverride, startImpersonation } from "@/actions/admin";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useAction } from "@/components/use-action";
import { PLANS, PLAN_IDS } from "@/config/plans";

export function ImpersonateButton({
  userId,
  email,
  disabled,
}: {
  userId: string;
  email: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const { run } = useAction(startImpersonation);
  return (
    <ConfirmDialog
      destructive={false}
      title={`View the app as ${email}?`}
      description="Impersonation is read-only, lasts 30 minutes and is recorded in the audit log at start and end."
      confirmLabel="Start impersonation"
      onConfirm={async () => {
        const res = await run(userId);
        if (res.ok) {
          router.push("/onboarding");
          router.refresh();
        }
        return res.ok;
      }}
      trigger={
        <Button variant="outline" size="sm" disabled={disabled}>
          <Eye /> Impersonate
        </Button>
      }
    />
  );
}

export function PlanOverrideSelect({ orgId, value }: { orgId: string; value: string | null }) {
  const router = useRouter();
  const { run, pending } = useAction(setPlanOverride);
  return (
    <select
      aria-label="Plan override"
      disabled={pending}
      className="border-input bg-background h-8 rounded-md border px-2 text-xs shadow-xs"
      value={value ?? ""}
      onChange={async (e) => {
        const res = await run(orgId, e.target.value || null);
        if (res.ok) {
          toast.success("Plan override saved");
          router.refresh();
        }
      }}
    >
      <option value="">No override</option>
      {PLAN_IDS.map((id) => (
        <option key={id} value={id}>
          {PLANS[id].name}
        </option>
      ))}
    </select>
  );
}

export function ReplayButton({ id }: { id: string }) {
  const router = useRouter();
  const { run, pending } = useAction(replayWebhook);
  return (
    <Button
      variant="outline"
      size="sm"
      loading={pending}
      onClick={async () => {
        const res = await run(id);
        if (res.ok) {
          if (res.data.status === 200) toast.success(`Replayed: ${res.data.result}`);
          else
            toast.error(`Replay failed: ${"error" in res.data ? res.data.error : res.data.result}`);
          router.refresh();
        }
      }}
    >
      {pending ? null : <RotateCcw />} Replay
    </Button>
  );
}
