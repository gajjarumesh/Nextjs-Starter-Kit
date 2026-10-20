"use client";

import { useRouter } from "next/navigation";
import { acceptInvitation } from "@/actions/member";
import { useAction } from "@/components/use-action";
import { Button } from "@/components/ui/button";

export function AcceptInviteButton({ token }: { token: string }) {
  const router = useRouter();
  const { run, pending } = useAction(acceptInvitation);
  return (
    <Button
      className="w-full"
      loading={pending}
      onClick={async () => {
        const res = await run(token);
        if (res.ok) {
          router.push(`/${res.data.orgSlug}/dashboard`);
          router.refresh();
        }
      }}
    >
      Accept invitation
    </Button>
  );
}
