"use client";

/**
 * VM3 List + ListItem — baris konten dengan leading icon, judul, support text,
 * trailing slot. Item interaktif dengan state layer.
 */
import { forwardRef, type HTMLAttributes, type LiHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/design-system/utilities/cn";
import { StateLayer } from "@/components/primitives/StateLayer";

export function List({ className, ...rest }: HTMLAttributes<HTMLUListElement>) {
  return <ul className={cn("vm3-list", className)} {...rest} />;
}

export interface ListItemProps extends Omit<LiHTMLAttributes<HTMLLIElement>, "onClick"> {
  leadingIcon?: ReactNode;
  primary: ReactNode;
  supporting?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
}

export const ListItem = forwardRef<HTMLLIElement, ListItemProps>(
  ({ leadingIcon, primary, supporting, trailing, onClick, className, ...rest }, ref) => {
    const interactive = Boolean(onClick);
    const content = (
      <>
        {interactive && <StateLayer />}
        {leadingIcon && (
          <span className="material-symbols-rounded vm3-list-item-icon" aria-hidden>
            {leadingIcon}
          </span>
        )}
        <span className="vm3-list-item-text">
          <span className="vm3-list-item-title">{primary}</span>
          {supporting && <span className="vm3-list-item-support">{supporting}</span>}
        </span>
        {trailing && <span className="vm3-list-item-trailing">{trailing}</span>}
      </>
    );
    if (interactive) {
      return (
        <li ref={ref} className={cn("vm3-list-item-wrap", className)} {...rest}>
          <button
            type="button"
            className="vm3-interactive vm3-list-item"
            onClick={onClick}
          >
            {content}
          </button>
        </li>
      );
    }
    return (
      <li ref={ref} className={cn("vm3-list-item", className)} {...rest}>
        {content}
      </li>
    );
  },
);
ListItem.displayName = "ListItem";

export function Divider({ inset, className, ...rest }: { inset?: boolean } & HTMLAttributes<HTMLHRElement>) {
  return <hr className={cn("vm3-divider", inset && "vm3-divider-inset", className)} {...rest} />;
}
