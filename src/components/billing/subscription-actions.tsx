"use client";

import { ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cancelSubscription, openBillingPortal, resumeSubscription } from "@/actions/billing";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useAction } from "@/components/use-action";
import { formatDate } from "@/lib/format";

export function SubscriptionActions({
  orgSlug,
  provider,
  cancelAtPeriodEnd,
  periodEnd,
}: {
  orgSlug: string;
  provider: "STRIPE" | "RAZORPAY";
  cancelAtPeriodEnd: boolean;
  periodEnd: string;
}) {
  const router = useRouter();
  const cancel = useAction(cancelSubscription);
  const resume = useAction(resumeSubscription);
  const portal = useAction(openBillingPortal);

  return (
    <div className="flex flex-wrap gap-2">
      {provider === "STRIPE" ? (
        <Button
          variant="outline"
          loading={portal.pending}
          onClick={async () => {
            const res = await portal.run(orgSlug);
            if (res.ok) window.location.assign(res.data.url);
          }}
        >
          Payment method & invoices <ExternalLink />
        </Button>
      ) : null}
      {cancelAtPeriodEnd ? (
        provider === "STRIPE" ? (
          <Button
            loading={resume.pending}
            onClick={async () => {
              const res = await resume.run(orgSlug);
              if (res.ok) {
                toast.success("Subscription resumed");
                router.refresh();
              }
            }}
          >
            Resume subscription
          </Button>
        ) : null
      ) : (
        <ConfirmDialog
          title="Cancel subscription?"
          description={`You keep paid features until ${formatDate(periodEnd)}. After that the organization moves to the Free plan; data over Free limits becomes read-only.`}
          confirmLabel="Cancel subscription"
          onConfirm={async () => {
            const res = await cancel.run(orgSlug);
            if (res.ok) {
              toast.success("Your subscription will end at the end of the period.");
              router.refresh();
            }
            return res.ok;
          }}
          trigger={
            <Button
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              Cancel subscription
            </Button>
          }
        />
      )}
    </div>
  );
}
