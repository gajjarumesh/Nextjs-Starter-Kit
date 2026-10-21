"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PricingTable } from "./pricing-table";

/** The demo app's own plans, i.e. what a buyer's customers would see. Not LaunchKit's price. */
export function PublicPricing() {
  return (
    <PricingTable
      renderAction={() => (
        <Button asChild className="w-full" variant="outline">
          <Link href="/demo?start=billing">See this in the demo</Link>
        </Button>
      )}
    />
  );
}
