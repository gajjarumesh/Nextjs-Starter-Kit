import { redirect } from "next/navigation";

/** Licence pricing lives on the sales page; keep old links working. */
export default function PricingPage() {
  redirect("/#buy");
}
