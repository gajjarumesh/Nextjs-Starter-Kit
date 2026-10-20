import type { Metadata } from "next";
import { PublicPricing } from "@/components/billing/public-pricing";

export const metadata: Metadata = { title: "Pricing" };

export default function PricingPage() {
  return (
    <section className="container-page py-20">
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Pricing</h1>
        <p className="text-muted-foreground mt-4 text-lg">
          Start free. Upgrade when you need more seats and AI. Pay with cards worldwide through
          Stripe, or UPI and cards in INR through Razorpay.
        </p>
      </div>
      <PublicPricing />
      <p className="text-muted-foreground mt-10 text-center text-sm">
        Prices exclude taxes. Cancel any time; you keep access until the end of the period.
      </p>
    </section>
  );
}
