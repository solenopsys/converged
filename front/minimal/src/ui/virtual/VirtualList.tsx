import $ from "@solenopsys/converged-reactive";
import { Component } from "@solenopsys/converged-renderer";
import { useVirtualizer, type VirtualItem } from "./useVirtualizer";

export interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => any;
  itemHeight?: number;
  height?: number | string;
  overscan?: number;
  className?: string;
  horizontal?: boolean;
  getItemKey?: (item: T, index: number) => string | number;
}

const defaultGetItemKey = <T,>(item: T, index: number): string | number => {
  if (item && typeof item === "object" && "id" in item) {
    return (item as any).id;
  }
  return index;
};

export const VirtualList: Component<VirtualListProps<any>> = (props) => {
  let scrollRef: HTMLDivElement | null = null;

  const itemHeight = props.itemHeight || 50;
  const overscan = props.overscan ?? 3;
  const horizontal = props.horizontal || false;
  const getItemKey = props.getItemKey || defaultGetItemKey;

  const virtualizer = useVirtualizer({
    count: props.items.length,
    getScrollElement: () => scrollRef,
    estimateSize: () => itemHeight,
    overscan,
    horizontal,
  });

  // Update count when items change
  $.effect(() => {
    const count = props.items.length;
    virtualizer.getVirtualizer()?.setOptions({
      ...virtualizer.getVirtualizer()!.options,
      count,
    });
    virtualizer.getVirtualizer()?._willUpdate();
  });

  return () => {
    const items = virtualizer.virtualItems();
    const totalSize = virtualizer.totalSize();
    const height = props.height || 400;

    const containerStyle = horizontal
      ? {
          height: typeof height === "number" ? `${height}px` : height,
          width: "100%",
          overflowX: "auto",
          overflowY: "hidden",
        }
      : {
          height: typeof height === "number" ? `${height}px` : height,
          overflow: "auto",
        };

    const innerStyle = horizontal
      ? {
          width: `${totalSize}px`,
          height: "100%",
          position: "relative",
        }
      : {
          height: `${totalSize}px`,
          width: "100%",
          position: "relative",
        };

    return (
      <div
        ref={(el) => {
          scrollRef = el;
        }}
        class={props.className}
        style={containerStyle as any}
      >
        <div style={innerStyle as any}>
          {items.map((virtualItem: VirtualItem) => {
            const item = props.items[virtualItem.index];
            if (!item) return null;

            const key = getItemKey(item, virtualItem.index);

            const itemStyle = horizontal
              ? {
                  position: "absolute",
                  top: 0,
                  left: 0,
                  height: "100%",
                  width: `${virtualItem.size}px`,
                  transform: `translateX(${virtualItem.start}px)`,
                }
              : {
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                };

            return (
              <div
                key={key}
                ref={(el) => {
                  if (el) virtualizer.measureElement(el);
                }}
                data-index={virtualItem.index}
                style={itemStyle as any}
              >
                {props.renderItem(item, virtualItem.index)}
              </div>
            );
          })}
        </div>
      </div>
    );
  };
};

export default VirtualList;
