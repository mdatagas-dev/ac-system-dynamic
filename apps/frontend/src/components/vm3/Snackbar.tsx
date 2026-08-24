"use client";

/**
 * VM3 Snackbar — viewport + item (inverse-surface), aria-live polite.
 * Tanpa dependency Toast — cukup animasi + timeout.
 */
import { AnimatePresence, motion } from "motion/react";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { slideUp } from "@/design-system/motion/presets";
import { useVm3ReducedMotion, withReducedMotion } from "@/hooks/useVm3ReducedMotion";

export interface SnackbarItem {
  id: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface SnackbarContextValue {
  show: (message: string, opts?: { actionLabel?: string; onAction?: () => void }) => void;
}

const SnackbarContext = createContext<SnackbarContextValue | null>(null);

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<SnackbarItem[]>([]);
  const reduced = useVm3ReducedMotion();

  const show = useCallback<SnackbarContextValue["show"]>((message, opts) => {
    const id = Math.random().toString(36).slice(2);
    setItems((list) => [...list, { id, message, ...opts }]);
    window.setTimeout(() => {
      setItems((list) => list.filter((i) => i.id !== id));
    }, 4000);
  }, []);

  return (
    <SnackbarContext.Provider value={{ show }}>
      {children}
      <div className="vm3-snackbar-viewport" role="status" aria-live="polite">
        <AnimatePresence>
          {items.map((item) => (
            <motion.div
              key={item.id}
              variants={withReducedMotion(slideUp, reduced)}
              initial="initial"
              animate="animate"
              exit="exit"
              layout
            >
              <div className="vm3-snackbar">
                <span>{item.message}</span>
                {item.actionLabel && (
                  <button
                    type="button"
                    className="vm3-snackbar-action"
                    onClick={() => {
                      item.onAction?.();
                      setItems((list) => list.filter((i) => i.id !== item.id));
                    }}
                  >
                    {item.actionLabel}
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </SnackbarContext.Provider>
  );
}

export function useSnackbar(): SnackbarContextValue {
  const ctx = useContext(SnackbarContext);
  if (!ctx) throw new Error("useSnackbar harus dipakai di dalam SnackbarProvider");
  return ctx;
}
