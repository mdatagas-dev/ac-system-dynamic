"use client";

/**
 * VM3 BottomSheet — Base UI Dialog, menempel bawah.
 * Animasi 100% CSS (vm3-sheet data-open) — slideY 16px + opacity, compositor only.
 */
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { type ReactNode } from "react";
import { cn } from "@/design-system/utilities/cn";

export interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function BottomSheet({ open, onOpenChange, title, children, className }: BottomSheetProps) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="vm3-scrim" />
        <BaseDialog.Popup className={cn("vm3-sheet", className)}>
          <div className="vm3-sheet-handle" aria-hidden />
          {title && <BaseDialog.Title className="vm3-dialog-title">{title}</BaseDialog.Title>}
          {children}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
