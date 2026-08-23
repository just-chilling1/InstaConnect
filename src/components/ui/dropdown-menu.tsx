"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

function DropdownMenuContent({
  className,
  sideOffset = 8,
  collisionPadding = 8,
  align = "center",
  side = "bottom",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPortal>
      {/*
        This is the actual fix for the overflow bug: rather than a
        hand-rolled `absolute right-0` div (which assumes there's always
        room to the dropdown's left -- false for a trigger near the left
        edge of the screen, like the sidebar's theme toggle), Radix measures
        the trigger's position against the real viewport on every open and
        picks/flips `side`/`align` so the content never renders outside it.
        `collisionPadding` keeps a margin from the viewport edge even after
        flipping, instead of butting right up against it.
      */}
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        align={align}
        side={side}
        className={cn(
          "z-50 min-w-40 overflow-hidden rounded-lg border border-border bg-surface p-1 shadow-lg",
          "data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-150",
          className
        )}
        {...props}
      />
    </DropdownMenuPortal>
  );
}

function DropdownMenuItem({
  className,
  active,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & { active?: boolean }) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-left cursor-pointer outline-none select-none transition-colors",
        active ? "text-accent-strong bg-accent-soft" : "text-text hover:bg-surface-2",
        "data-[highlighted]:bg-surface-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem };
