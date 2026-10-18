"use client";

import * as DM from "@radix-ui/react-dropdown-menu";
import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Dropdown menu (Radix: keyboard, focus and screen-reader handling built in).
export const Menu = DM.Root;
export const MenuTrigger = DM.Trigger;
export const MenuGroup = DM.Group;
export const MenuRadioGroup = DM.RadioGroup;

export function MenuContent({ className, align = "end", ...p }: DM.DropdownMenuContentProps) {
  return (
    <DM.Portal>
      <DM.Content
        align={align}
        sideOffset={6}
        collisionPadding={8}
        className={cn(
          "z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-48 overflow-y-auto rounded-lg border border-line bg-surface p-1 text-sm text-foreground shadow-md",
          className,
        )}
        {...p}
      />
    </DM.Portal>
  );
}

const itemCls =
  "flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 outline-none select-none data-[highlighted]:bg-surface-2 data-[disabled]:opacity-50 pointer-coarse:min-h-11 [&_svg]:size-4 [&_svg]:text-muted";

export const MenuItem = ({ className, ...p }: DM.DropdownMenuItemProps) => (
  <DM.Item className={cn(itemCls, className)} {...p} />
);
export const MenuCheckboxItem = ({ className, children, ...p }: DM.DropdownMenuCheckboxItemProps) => (
  <DM.CheckboxItem className={cn(itemCls, "pl-8 relative", className)} {...p}>
    <DM.ItemIndicator className="absolute left-2 text-primary">✓</DM.ItemIndicator>
    {children}
  </DM.CheckboxItem>
);
export const MenuRadioItem = ({ className, children, ...p }: DM.DropdownMenuRadioItemProps) => (
  <DM.RadioItem className={cn(itemCls, "pl-8 relative", className)} {...p}>
    <DM.ItemIndicator className="absolute left-2.5 size-2 rounded-full bg-primary" />
    {children}
  </DM.RadioItem>
);
export const MenuLabel = ({ className, ...p }: DM.DropdownMenuLabelProps) => (
  <DM.Label className={cn("px-2 py-1.5 text-xs font-medium text-muted", className)} {...p} />
);
export const MenuSeparator = () => <DM.Separator className="my-1 h-px bg-line" />;

// Sheet: a dialog that slides in from a side (mobile nav, tile details).
export const Sheet = D.Root;
export const SheetTrigger = D.Trigger;
export const SheetClose = D.Close;

export function SheetContent({
  side = "right",
  title,
  description,
  className,
  children,
}: {
  side?: "left" | "right" | "bottom";
  title: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const pos = {
    left: "inset-y-0 left-0 h-full w-[85vw] max-w-xs border-r",
    right: "inset-y-0 right-0 h-full w-full max-w-md border-l",
    bottom: "inset-x-0 bottom-0 max-h-[85vh] rounded-t-xl border-t",
  }[side];
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/40" />
      <D.Content
        className={cn(
          "fixed z-50 flex flex-col overflow-y-auto border-line bg-surface shadow-md outline-none",
          pos,
          className,
        )}
      >
        <div className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            <D.Title className="text-base font-semibold">{title}</D.Title>
            {description ? (
              <D.Description className="text-sm text-muted">{description}</D.Description>
            ) : (
              <D.Description className="sr-only">{title}</D.Description>
            )}
          </div>
          <D.Close
            className="grid size-10 place-items-center rounded-md text-muted hover:bg-surface-2"
            aria-label="Close"
          >
            <X className="size-5" />
          </D.Close>
        </div>
        <div className="flex-1 p-4">{children}</div>
      </D.Content>
    </D.Portal>
  );
}
