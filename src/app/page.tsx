import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

/** There is no public site: visitors go to sign-in, signed-in users to their workspace. */
export default async function RootPage() {
  const user = await getCurrentUser();
  redirect(user ? "/onboarding" : "/sign-in");
}
