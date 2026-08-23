"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetPortal = SheetPrimitive.Portal;

function SheetOverlay({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-ink/60 transition-opacity duration-300",
        "data-[state=open]:opacity-100 data-[state=closed]:opacity-0",
        className
      )}
      {...props}
    />
  );
}

type SheetContentProps = React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "left" | "right";
};

function SheetContent({ className, side = "left", children, ...props }: SheetContentProps) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        className={cn(
          "fixed inset-y-0 z-50 flex h-full w-72 flex-col gap-4 border-border bg-surface p-5 shadow-lg",
          "transition-transform duration-300 ease-out",
          side === "left" &&
            "left-0 border-r data-[state=closed]:-translate-x-full data-[state=open]:translate-x-0",
          side === "right" &&
            "right-0 border-l data-[state=closed]:translate-x-full data-[state=open]:translate-x-0",
          className
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="absolute right-4 top-4 rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-text">
          <IconX size={18} />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5", className)} {...props} />;
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      className={cn("font-display text-base font-semibold text-text", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description className={cn("text-sm text-text-muted", className)} {...props} />
  );
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetDescription };
