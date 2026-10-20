"use client";

import { createAuthClient } from "better-auth/react";

/** Browser-side auth client (same origin as the app). */
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
