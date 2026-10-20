"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteOrganization } from "@/actions/organization";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAction } from "@/components/use-action";

export function DangerZone({ orgSlug, orgName }: { orgSlug: string; orgName: string }) {
  const router = useRouter();
  const { run } = useAction(deleteOrganization);
  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">Danger zone</CardTitle>
        <CardDescription>Only Owners can delete the organization.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          <p className="font-medium">Delete {orgName}</p>
          <p className="text-muted-foreground">
            Members lose access immediately. Billing records are kept for accounting.
          </p>
        </div>
        <ConfirmDialog
          title={`Delete ${orgName}?`}
          description="This removes the organization for every member. Cancel any active subscription first."
          confirmLabel="Delete organization"
          requireText={orgSlug}
          onConfirm={async (typed) => {
            const res = await run(orgSlug, typed);
            if (res.ok) {
              toast.success("Organization deleted");
              router.push("/onboarding");
              router.refresh();
            }
            return res.ok;
          }}
          trigger={<Button variant="destructive">Delete organization</Button>}
        />
      </CardContent>
    </Card>
  );
}
