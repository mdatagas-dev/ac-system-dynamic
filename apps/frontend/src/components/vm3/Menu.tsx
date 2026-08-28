"use client";

/**
 * VM3 Menu — shadcn/ui DropdownMenu. API: trigger + items.
 */
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export interface MenuItemDef {
  label: string;
  icon?: string;
  onSelect?: () => void;
  disabled?: boolean;
}

export interface MenuProps {
  trigger: ReactNode;
  items: MenuItemDef[];
  className?: string;
}

export function Menu({ trigger, items, className }: MenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={cn("min-w-40", className)}>
        {items.map((item) => (
          <DropdownMenuItem
            key={item.label}
            disabled={item.disabled}
            onSelect={() => item.onSelect?.()}
            className="gap-2"
          >
            {item.icon && (
              <span className="material-symbols-rounded text-base" aria-hidden>
                {item.icon}
              </span>
            )}
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
