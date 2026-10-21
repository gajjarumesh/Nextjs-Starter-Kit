"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { switchDemoRole } from "@/actions/demo";
import type { DemoRole } from "@/config/demo";

/** Switches the demo session to the sandbox user with another role, then re-renders the page. */
export function useDemoRole(orgSlug: string) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function switchTo(role: DemoRole) {
    start(async () => {
      const res = await switchDemoRole(orgSlug, role);
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`You're now the ${role.toLowerCase()}`);
      router.refresh();
    });
  }
  return { switchTo, pending };
}
