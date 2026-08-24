"use client";

/**
 * VM3 Navigation — AppBar, NavigationBar (mobile), NavigationRail (desktop),
 * NavigationDrawer, Tabs.
 * Animasi drawer/scrim memakai transisi CSS via atribut Base UI
 * ([data-open], [data-ending-style]) — lihat navigation.css & overlays.css.
 */
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/design-system/utilities/cn";
import { StateLayer } from "@/components/primitives/StateLayer";

/* ---------- App Bar ---------- */
export interface AppBarProps {
  title?: ReactNode;
  leading?: ReactNode;
  actions?: ReactNode;
  /** true saat halaman digulir → appbar mendapat elevasi */
  scrolled?: boolean;
  className?: string;
}

export function AppBar({ title, leading, actions, scrolled, className }: AppBarProps) {
  return (
    <header className={cn("vm3-appbar", className)} data-scrolled={scrolled || undefined}>
      {leading}
      <div className="vm3-appbar-title">{title}</div>
      {actions}
    </header>
  );
}

/* ---------- Navigation Item (dipakai bar & rail) ---------- */
export interface NavItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  label: string;
  active?: boolean;
}

export const NavItem = forwardRef<HTMLButtonElement, NavItemProps>(
  ({ icon, label, active, className, ...rest }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn("vm3-navbar-item", className)}
      data-active={active || undefined}
      aria-current={active ? "page" : undefined}
      {...rest}
    >
      <span className="material-symbols-rounded vm3-navbar-icon" aria-hidden>
        {icon}
      </span>
      <span>{label}</span>
    </button>
  ),
);
NavItem.displayName = "NavItem";

/* ---------- Navigation Bar (mobile) ---------- */
export function NavigationBar({ children, className }: { children: ReactNode; className?: string }) {
  return <nav className={cn("vm3-navbar", className)}>{children}</nav>;
}

/* ---------- Navigation Rail (desktop) ---------- */
export interface RailItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  label: string;
  active?: boolean;
}

export const RailItem = forwardRef<HTMLButtonElement, RailItemProps>(
  ({ icon, label, active, className, ...rest }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn("vm3-rail-item", className)}
      data-active={active || undefined}
      aria-current={active ? "page" : undefined}
      {...rest}
    >
      <span className="vm3-rail-pill">
        <span className="material-symbols-rounded vm3-rail-icon" aria-hidden>
          {icon}
        </span>
      </span>
      <span>{label}</span>
    </button>
  ),
);
RailItem.displayName = "RailItem";

export function NavigationRail({
  children,
  expanded,
  className,
}: {
  children: ReactNode;
  /** true → rail melebar jadi navigasi menyamping (ikon + label) */
  expanded?: boolean;
  className?: string;
}) {
  return (
    <nav className={cn("vm3-rail", className)} data-expanded={expanded ? "true" : "false"}>
      {children}
    </nav>
  );
}

/* ---------- Navigation Drawer ---------- */
export interface NavigationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
}

export function NavigationDrawer({ open, onOpenChange, children, className }: NavigationDrawerProps) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="vm3-scrim" />
        <BaseDialog.Popup className={cn("vm3-drawer", className)}>
          {children}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

/* ---------- Tabs ---------- */
export interface Tab {
  value: string;
  label: string;
  icon?: string;
}

export interface TabsProps {
  tabs: Tab[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function Tabs({ tabs, value, onChange, className }: TabsProps) {
  return (
    <div role="tablist" className={cn("vm3-tabs", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          className="vm3-tab"
          data-active={value === tab.value || undefined}
          onClick={() => onChange(tab.value)}
        >
          {tab.icon && (
            <span className="material-symbols-rounded" aria-hidden>
              {tab.icon}
            </span>
          )}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Menu Item re-export kecil (state layer dipakai nav) ---------- */
export { StateLayer };
