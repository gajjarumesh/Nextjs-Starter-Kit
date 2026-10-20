import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeader } from "@/components/auth/auth-header";
import { SignInForm } from "@/components/auth/sign-in-form";
import { features } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <>
      <AuthHeader title="Welcome back" description="Sign in to your account." />
      <SignInForm next={next} googleEnabled={features.google} />
      <p className="text-muted-foreground mt-6 text-center text-sm">
        New here?{" "}
        <Link
          href={next ? `/sign-up?next=${encodeURIComponent(next)}` : "/sign-up"}
          className="text-primary font-medium hover:underline"
        >
          Create an account
        </Link>
      </p>
    </>
  );
}
