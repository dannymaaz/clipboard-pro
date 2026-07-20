import type { ReactNode } from "react";
import { useMemo, useState } from "react";

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  height: number;
  overscan?: number;
  onNearEnd?: () => void;
  renderItem: (item: T, index: number) => ReactNode;
}

export function VirtualList<T>({ items, itemHeight, height, overscan = 6, onNearEnd, renderItem }: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const totalHeight = items.length * itemHeight;
  const range = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(height / itemHeight) + overscan * 2;
    const end = Math.min(items.length, start + visibleCount);
    return { start, end };
  }, [height, itemHeight, items.length, overscan, scrollTop]);

  return (
    <div
      className="custom-scrollbar overflow-y-auto"
      style={{ height }}
      onScroll={(event) => {
        const { clientHeight, scrollHeight, scrollTop } = event.currentTarget;
        setScrollTop(scrollTop);
        if (scrollTop + clientHeight >= scrollHeight - itemHeight * 2) onNearEnd?.();
      }}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <div style={{ transform: `translateY(${range.start * itemHeight}px)` }}>
          {items.slice(range.start, range.end).map((item, offset) => renderItem(item, range.start + offset))}
        </div>
      </div>
    </div>
  );
}
