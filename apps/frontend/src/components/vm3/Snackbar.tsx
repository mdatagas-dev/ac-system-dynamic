"use client";

/**
 * VM3 Snackbar — sonner toast. API sama: SnackbarProvider + useSnackbar().show().
 */
import { createContext, useContext, type ReactNode } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

interface SnackbarContextValue {
  show: (message: string, opts?: { actionLabel?: string; onAction?: () => void }) => void;
}

const SnackbarContext = createContext<SnackbarContextValue | null>(null);

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const show: SnackbarContextValue["show"] = (message, opts) => {
    if (opts?.actionLabel && opts.onAction) {
      toast(message, { action: { label: opts.actionLabel, onClick: opts.onAction } });
    } else {
      toast(message);
    }
  };

  return (
    <SnackbarContext.Provider value={{ show }}>
      {children}
      <Toaster position="top-center" />
    </SnackbarContext.Provider>
  );
}

export function useSnackbar(): SnackbarContextValue {
  const ctx = useContext(SnackbarContext);
  if (!ctx) throw new Error("useSnackbar harus dipakai di dalam SnackbarProvider");
  return ctx;
}
