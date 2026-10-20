"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; details?: unknown; requestId?: string } };

/** Calls a server action, tracks pending state and toasts errors (with the request id). */
export function useAction<A extends unknown[], T>(action: (...args: A) => Promise<Result<T>>) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(...args: A): Promise<Result<T>> {
    setError(null);
    return new Promise((resolve) => {
      startTransition(async () => {
        const res = await action(...args);
        if (!res.ok) {
          setError(res.error.message);
          toast.error(res.error.message, {
            description: res.error.requestId ? `Reference: ${res.error.requestId}` : undefined,
          });
        }
        resolve(res);
      });
    });
  }

  return { run, pending, error, setError };
}
