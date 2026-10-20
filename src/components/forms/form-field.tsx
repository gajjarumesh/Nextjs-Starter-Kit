"use client";

import { useId, type ReactNode } from "react";
import type { FieldError, UseFormRegisterReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Ties a React Hook Form field to its Zod error message. */
export function FormField({
  label,
  error,
  hint,
  className,
  children,
  id: idProp,
  labelAction,
}: {
  label: string;
  error?: FieldError | { message?: string };
  hint?: ReactNode;
  className?: string;
  id?: string;
  labelAction?: ReactNode;
  children: (props: {
    id: string;
    "aria-invalid": boolean;
    "aria-describedby"?: string;
  }) => ReactNode;
}) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const msgId = `${id}-msg`;
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        {labelAction}
      </div>
      {children({
        id,
        "aria-invalid": Boolean(error),
        "aria-describedby": error || hint ? msgId : undefined,
      })}
      {error?.message ? (
        <p id={msgId} className="text-destructive text-xs font-medium">
          {error.message}
        </p>
      ) : hint ? (
        <p id={msgId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Shorthand for the common text-input case. */
export function TextField({
  label,
  error,
  hint,
  registration,
  className,
  labelAction,
  ...inputProps
}: {
  label: string;
  error?: FieldError;
  hint?: ReactNode;
  registration: UseFormRegisterReturn;
  className?: string;
  labelAction?: ReactNode;
} & Omit<React.ComponentProps<typeof Input>, "id">) {
  return (
    <FormField
      label={label}
      error={error}
      hint={hint}
      className={className}
      labelAction={labelAction}
    >
      {(a11y) => <Input {...a11y} {...inputProps} {...registration} />}
    </FormField>
  );
}
