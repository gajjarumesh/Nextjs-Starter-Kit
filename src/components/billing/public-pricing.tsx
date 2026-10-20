"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PricingTable } from "./pricing-table";

export function PublicPricing() {
  return (
    <PricingTable
      renderAction={(planId) => (
        <Button asChild className="w-full" variant={planId === "pro" ? "default" : "outline"}>
          <Link href={`/sign-up?plan=${planId}`}>
            {planId === "free" ? "Start for free" : "Start free trial"}
          </Link>
        </Button>
      )}
    />
  );
}
