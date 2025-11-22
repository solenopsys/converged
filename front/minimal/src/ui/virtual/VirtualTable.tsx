import { Component } from "@solenopsys/converged-renderer";
import { useVirtualizer, type VirtualItem } from "./useVirtualizer";

export interface Column<T> {
  key: string;
  header: string;
  width?: number;
  render?: (item: T, index: number) => any;
}

export interface VirtualTableProps<T> {
  data: T[] | (() => T[]);
  columns: Column<T>[];
  rowHeight?: number;
  height?: number | string;
  overscan?: number;
  className?: string;
  onRowClick?: (item: T, index: number) => void;
  getRowKey?: (item: T, index: number) => string | number;
  onLoadMore?: () => void;
  totalCount?: number;
  onMount?: (api: { updateData: () => void }) => void;
}

const defaultGetRowKey = <T,>(item: T, index: number): string | number => {
  if (item && typeof item === "object" && "id" in item) {
    return (item as any).id;
  }
  return index;
};

export const VirtualTable: Component<VirtualTableProps<any>> = (props) => {
  const rowHeight = props.rowHeight || 40;
  const overscan = props.overscan ?? 5;
  const getRowKey = props.getRowKey || defaultGetRowKey;
  const height = props.height || 400;

  // Support both array and getter function
  const getData = () => {
    if (typeof props.data === "function") {
      return props.data();
    }
    return props.data;
  };

  let containerEl: HTMLDivElement | null = null;
  let bodyEl: HTMLDivElement | null = null;
  let currentCount = getData().length;
  let virtualizerInstance = useVirtualizer({
    count: currentCount,
    getScrollElement: () => null,
    estimateSize: () => rowHeight,
    overscan,
  });

  const updateData = () => {
    const data = getData();
    const newCount = data.length;
    console.log("updateData: count =", newCount, "prev =", currentCount);
    currentCount = newCount;
    const v = virtualizerInstance.getVirtualizer();
    if (v) {
      v.setOptions({
        ...v.options,
        count: currentCount,
      });
      v._willUpdate();
    }
    renderRows();
  };

  const checkLoadMore = () => {
    if (!props.onLoadMore) return;

    const items = virtualizerInstance.getVirtualItems();
    if (items.length === 0) return;

    const lastItem = items[items.length - 1];
    const dataLength = getData().length;

    // Load more when last visible item is within 20 items of the end
    if (lastItem && lastItem.index >= dataLength - 20) {
      props.onLoadMore();
    }
  };

  const renderRows = () => {
    if (!bodyEl) return;

    const items = virtualizerInstance.getVirtualItems();
    const totalSize = virtualizerInstance.getTotalSize();
    const data = getData();

    console.log("renderRows:", items.length, "totalSize:", totalSize);

    // Update container height
    const container = bodyEl.firstElementChild as HTMLElement;
    if (container) {
      container.style.height = `${totalSize}px`;
    }

    // Clear and re-render rows
    if (container) {
      container.innerHTML = "";

      items.forEach((virtualRow: VirtualItem) => {
        const item = data[virtualRow.index];
        if (!item) return;

        const rowEl = document.createElement("div");
        rowEl.setAttribute("data-index", String(virtualRow.index));
        rowEl.style.cssText = `
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: ${virtualRow.size}px;
          transform: translateY(${virtualRow.start}px);
          display: flex;
          align-items: center;
          border-bottom: 1px solid var(--border, #e5e7eb);
          cursor: ${props.onRowClick ? "pointer" : "default"};
          transition: background-color 0.15s;
        `;

        if (props.onRowClick) {
          rowEl.onclick = () => props.onRowClick!(item, virtualRow.index);
        }

        rowEl.onmouseenter = () => {
          rowEl.style.backgroundColor = "var(--accent, #f3f4f6)";
        };
        rowEl.onmouseleave = () => {
          rowEl.style.backgroundColor = "";
        };

        props.columns.forEach((col) => {
          const cellEl = document.createElement("div");
          cellEl.style.cssText = `
            flex: ${col.width ? `0 0 ${col.width}px` : "1"};
            padding: 8px 16px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 14px;
          `;
          cellEl.textContent = col.render
            ? String(col.render(item, virtualRow.index))
            : String((item as any)[col.key]);
          rowEl.appendChild(cellEl);
        });

        container.appendChild(rowEl);
      });
    }
  };

  return (
    <div
      class={props.className}
      style={{
        display: "flex",
        flexDirection: "column",
        height: typeof height === "number" ? `${height}px` : height,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          borderBottom: "2px solid var(--border, #e5e7eb)",
          fontWeight: "600",
          fontSize: "14px",
          backgroundColor: "var(--muted, #f9fafb)",
        }}
      >
        {props.columns.map((col) => (
          <div
            key={col.key}
            style={{
              flex: col.width ? `0 0 ${col.width}px` : "1",
              padding: "12px 16px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {col.header}
          </div>
        ))}
      </div>

      {/* Scrollable body */}
      <div
        ref={(el) => {
          if (el && !containerEl) {
            containerEl = el;
            bodyEl = el;
            virtualizerInstance.init(el);
            virtualizerInstance.setOnUpdate(() => {
              renderRows();
              checkLoadMore();
            });
            el.addEventListener("scroll", checkLoadMore);
            renderRows();
            props.onMount?.({ updateData });
          }
        }}
        style={{
          flex: "1",
          overflow: "auto",
          position: "relative",
        }}
      >
        {/* Total height container */}
        <div
          style={{
            height: `${getData().length * rowHeight}px`,
            width: "100%",
            position: "relative",
          }}
        ></div>
      </div>
    </div>
  );
};

export default VirtualTable;
