"use client";

import { Avatar as AvatarPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn, initials } from "@/lib/utils";

export function Avatar({
  name,
  src,
  className,
  ...props
}: ComponentProps<typeof AvatarPrimitive.Root> & { name?: string | null; src?: string | null }) {
  return (
    <AvatarPrimitive.Root
      className={cn("relative flex size-8 shrink-0 overflow-hidden rounded-full", className)}
      {...props}
    >
      {src ? (
        <AvatarPrimitive.Image
          src={src}
          alt={name ?? ""}
          className="aspect-square size-full object-cover"
        />
      ) : null}
      <AvatarPrimitive.Fallback className="from-primary/80 to-primary text-primary-foreground flex size-full items-center justify-center bg-gradient-to-br text-xs font-semibold">
        {initials(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
