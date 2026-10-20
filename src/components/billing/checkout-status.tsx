"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * The success page never activates a plan. It shows "processing" and refreshes until the
 * webhook has updated the subscription.
 */
export function CheckoutProcessing({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (active) return;
    let tries = 0;
    const t = setInterval(() => {
      tries += 1;
      router.refresh();
      if (tries >= 20) clearInterval(t);
    }, 3000);
    return () => clearInterval(t);
  }, [active, router]);

  if (active) {
    return (
      <Alert variant="success">
        <AlertTitle>You&apos;re all set</AlertTitle>
        <AlertDescription>Your subscription is active. Thanks for upgrading!</AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert variant="info">
      <Loader2 className="animate-spin" />
      <AlertTitle>Processing your payment…</AlertTitle>
      <AlertDescription>
        This usually takes a few seconds. The page updates automatically when the provider confirms.
      </AlertDescription>
    </Alert>
  );
}
