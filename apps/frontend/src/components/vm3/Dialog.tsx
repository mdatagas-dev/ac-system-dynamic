"use client";

/**
 * VM3 Dialog — shadcn/ui Dialog. API sama: open, onOpenChange, title,
 * description, actions, children.
 */
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog as ShadDialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function Dialog({ open, onOpenChange, title, description, actions, children, className }: DialogProps) {
  return (
    <ShadDialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-lg", className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        {actions && <DialogFooter>{actions}</DialogFooter>}
      </DialogContent>
    </ShadDialog>
  );
}
