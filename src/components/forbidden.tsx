import { Lock } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export function Forbidden({ what = "this page" }: { what?: string }) {
  return (
    <EmptyState
      icon={Lock}
      title="You don't have access"
      description={`Your role doesn't include access to ${what}. Ask an Owner or Admin if you need it.`}
      className="mt-10"
    />
  );
}
