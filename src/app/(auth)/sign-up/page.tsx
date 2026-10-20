import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeader } from "@/components/auth/auth-header";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { features } from "@/lib/env";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; email?: string }>;
}) {
  const { next, email } = await searchParams;
  return (
    <>
      <AuthHeader title="Create your account" description="Start free. No credit card required." />
      <SignUpForm next={next} email={email} googleEnabled={features.google} />
      <p className="text-muted-foreground mt-6 text-center text-sm">
        Already have an account?{" "}
        <Link
          href={next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in"}
          className="text-primary font-medium hover:underline"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}
