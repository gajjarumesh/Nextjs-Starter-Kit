"use client";

import { Check } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { PLANS, PLAN_IDS, type Interval, type PlanId } from "@/config/plans";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export type Currency = "USD" | "INR";

/** Reads PLANS directly. Monthly / yearly toggle, plus USD (Stripe) / INR (Razorpay) toggle. */
export function PricingTable({
  renderAction,
  currentPlanId,
  defaultCurrency = "USD",
  showCurrencyToggle = true,
}: {
  renderAction: (planId: PlanId, interval: Interval, currency: Currency) => ReactNode;
  currentPlanId?: PlanId;
  defaultCurrency?: Currency;
  showCurrencyToggle?: boolean;
}) {
  const [interval, setInterval] = useState<Interval>("month");
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Toggle
          value={interval}
          onChange={setInterval}
          options={[
            { value: "month", label: "Monthly" },
            {
              value: "year",
              label: "Yearly",
              extra: <Badge variant="success">2 months free</Badge>,
            },
          ]}
        />
        {showCurrencyToggle ? (
          <Toggle
            value={currency}
            onChange={setCurrency}
            options={[
              { value: "USD", label: "USD" },
              { value: "INR", label: "INR" },
            ]}
          />
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {PLAN_IDS.map((id) => {
          const plan = PLANS[id];
          const highlighted = "highlighted" in plan && plan.highlighted;
          const price = plan.price[currency][interval];
          const perMonth = interval === "year" ? Math.round(price / 12) : price;
          return (
            <div
              key={id}
              className={cn(
                "bg-card relative flex flex-col rounded-2xl border p-6 shadow-xs",
                highlighted &&
                  "border-primary/60 shadow-primary/10 ring-primary/30 shadow-lg ring-1",
              )}
            >
              {highlighted ? (
                <Badge className="bg-primary text-primary-foreground absolute -top-2.5 left-6">
                  Most popular
                </Badge>
              ) : null}
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <p className="text-muted-foreground text-sm">{plan.description}</p>
              </div>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight">
                  {formatMoney(perMonth, currency)}
                </span>
                <span className="text-muted-foreground text-sm">/ month</span>
              </div>
              <p className="text-muted-foreground mt-1 h-5 text-xs">
                {price > 0 && interval === "year"
                  ? `${formatMoney(price, currency)} billed yearly`
                  : null}
                {price > 0 && plan.trialDays > 0 && interval === "month"
                  ? `${plan.trialDays}-day free trial`
                  : null}
              </p>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="text-primary mt-0.5 size-4 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                {currentPlanId === id ? (
                  <div className="text-muted-foreground flex h-9 items-center justify-center rounded-md border border-dashed text-sm">
                    Current plan
                  </div>
                ) : (
                  renderAction(id, interval, currency)
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Toggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; extra?: ReactNode }[];
}) {
  return (
    <div
      role="radiogroup"
      className="bg-muted/50 inline-flex items-center gap-1 rounded-full border p-1"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "text-muted-foreground inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            value === o.value && "bg-background text-foreground shadow-sm",
          )}
        >
          {o.label}
          {o.extra}
        </button>
      ))}
    </div>
  );
}
