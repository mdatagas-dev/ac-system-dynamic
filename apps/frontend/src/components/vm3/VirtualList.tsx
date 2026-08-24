"use client";

/**
 * VM3 VirtualList — render list besar dengan TanStack Virtual.
 * Hanya elemen terlihat yang dirender (perf untuk log/history/activity).
 */
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, type ReactNode } from "react";
import { cn } from "@/design-system/utilities/cn";

export interface VirtualListProps<T> {
  items: T[];
  getKey: (item: T, index: number) => string | number;
  renderItem: (item: T, index: number) => ReactNode;
  estimateSize?: number;
  className?: string;
  overscan?: number;
}

export function VirtualList<T>({
  items,
  getKey,
  renderItem,
  estimateSize = 56,
  className,
  overscan = 8,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  });

  return (
    <div
      ref={parentRef}
      className={cn("vm3-virtuallist", className)}
      style={{ overflowY: "auto", maxHeight: "100%" }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((row) => (
          <div
            key={getKey(items[row.index], row.index)}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: `${row.size}px`,
              transform: `translateY(${row.start}px)`,
            }}
          >
            {renderItem(items[row.index], row.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
