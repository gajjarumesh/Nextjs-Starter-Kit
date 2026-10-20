import type { ReactNode } from "react";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { getCurrentUser } from "@/server/auth/session";

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const current = await getCurrentUser();
  return (
    <div className="flex min-h-dvh flex-col">
      <MarketingHeader signedIn={Boolean(current)} />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
