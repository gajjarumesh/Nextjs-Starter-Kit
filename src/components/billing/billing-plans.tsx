"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { changePlan, startCheckout } from "@/actions/billing";
import { Button } from "@/components/ui/button";
import { useAction } from "@/components/use-action";
import { PLANS, type Interval, type PlanId } from "@/config/plans";
import { PricingTable, type Currency } from "./pricing-table";

type Provider = "STRIPE" | "RAZORPAY";
type Live = { planId: PlanId; interval: Interval; provider: Provider } | null;

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Razorpay Checkout"));
    document.body.appendChild(s);
  });
}

/** Stripe = USD hosted checkout; Razorpay = INR checkout modal. Both end at a webhook. */
export function BillingPlans({
  orgSlug,
  orgName,
  email,
  live,
  providers,
  canManage,
}: {
  orgSlug: string;
  orgName: string;
  email: string;
  live: Live;
  providers: Provider[];
  canManage: boolean;
}) {
  const router = useRouter();
  const checkout = useAction(startCheckout);
  const change = useAction(changePlan);
  const [busy, setBusy] = useState<string | null>(null);
  const defaultCurrency: Currency =
    live?.provider === "RAZORPAY" ||
    (!providers.includes("STRIPE") && providers.includes("RAZORPAY"))
      ? "INR"
      : "USD";

  async function subscribe(planId: "pro" | "business", interval: Interval, currency: Currency) {
    const provider: Provider = currency === "INR" ? "RAZORPAY" : "STRIPE";
    if (!providers.includes(provider)) {
      toast.error(
        `${provider === "STRIPE" ? "Stripe" : "Razorpay"} is not configured. Add its keys to .env.`,
      );
      return;
    }
    setBusy(`${planId}-${interval}`);
    const res = await checkout.run(orgSlug, { planId, interval, provider });
    if (!res.ok) return setBusy(null);
    if (res.data.kind === "redirect") {
      window.location.assign(res.data.url);
      return;
    }
    try {
      await loadRazorpay();
      const rzp = new window.Razorpay!({
        key: res.data.keyId,
        subscription_id: res.data.subscriptionId,
        name: orgName,
        description: `${PLANS[planId].name} (${interval}ly)`,
        prefill: { email },
        theme: { color: "#4f46e5" },
        handler: () => router.push(`/${orgSlug}/settings/billing?checkout=success`),
        modal: { ondismiss: () => setBusy(null) },
      });
      rzp.open();
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(null);
    }
  }

  async function switchPlan(planId: "pro" | "business", interval: Interval) {
    setBusy(`${planId}-${interval}`);
    const res = await change.run(orgSlug, { planId, interval });
    setBusy(null);
    if (res.ok) {
      toast.success("Plan change requested. It will appear here once the provider confirms.");
      router.refresh();
    }
  }

  return (
    <PricingTable
      currentPlanId={live?.planId ?? "free"}
      defaultCurrency={defaultCurrency}
      showCurrencyToggle={!live && providers.length > 1}
      renderAction={(planId, interval, currency) => {
        if (planId === "free") {
          return (
            <Button variant="outline" className="w-full" disabled>
              {live ? "Cancel to downgrade" : "Included"}
            </Button>
          );
        }
        if (!canManage) {
          return (
            <Button variant="outline" className="w-full" disabled>
              Owner only
            </Button>
          );
        }
        const key = `${planId}-${interval}`;
        const isUpgrade = !live || PLANS[planId].seats > PLANS[live.planId].seats;
        return live ? (
          <Button
            className="w-full"
            variant={isUpgrade ? "default" : "outline"}
            loading={busy === key}
            disabled={busy !== null}
            onClick={() => switchPlan(planId, interval)}
          >
            {isUpgrade ? "Upgrade" : "Downgrade"} to {PLANS[planId].name}
          </Button>
        ) : (
          <Button
            className="w-full"
            variant={planId === "pro" ? "default" : "outline"}
            loading={busy === key}
            disabled={busy !== null}
            onClick={() => subscribe(planId, interval, currency)}
          >
            Start {PLANS[planId].trialDays}-day trial
          </Button>
        );
      }}
    />
  );
}
