import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const STATUS_LABEL: Record<string, string> = {
  TRIALING: "Trial",
  PAST_DUE: "Past due",
  CANCELED: "Canceled",
  INCOMPLETE: "Incomplete",
};

export function PlanBadge({ planName, status }: { planName: string; status?: string }) {
  const extra = status ? STATUS_LABEL[status] : undefined;
  const variant = status === "PAST_DUE" ? "warning" : planName === "Free" ? "secondary" : "default";
  return (
    <Badge variant={variant}>
      {planName !== "Free" ? <Sparkles /> : null}
      {planName}
      {extra ? <span className="opacity-80">· {extra}</span> : null}
    </Badge>
  );
}
