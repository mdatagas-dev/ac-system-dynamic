"use client";

/**
 * VM3 Dialog — Base UI Dialog + CSS transitions (overlay tokens).
 * Animasi 100% via CSS data-open/data-ending-style (compositor: opacity+scale).
 * Jauh lebih responsif daripada motion JS — enter 190ms, exit 140ms.
 * Focus trap, esc, aria: ditangani Base UI.
 */
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { type ReactNode } from "react";
import { cn } from "@/design-system/utilities/cn";

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
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="vm3-scrim" />
        <BaseDialog.Popup className={cn("vm3-dialog", className)}>
          <BaseDialog.Title className="vm3-dialog-title">{title}</BaseDialog.Title>
          {description && (
            <BaseDialog.Description className="vm3-dialog-description">{description}</BaseDialog.Description>
          )}
          {children}
          {actions && <div className="vm3-dialog-actions">{actions}</div>}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
