import {
  Virtualizer,
  elementScroll,
  observeElementOffset,
  observeElementRect,
  type VirtualizerOptions,
  type VirtualItem,
} from "@tanstack/virtual-core";

export type { VirtualItem, VirtualizerOptions };

export interface UseVirtualizerOptions<
  TScrollElement extends Element,
  TItemElement extends Element,
> extends Partial<VirtualizerOptions<TScrollElement, TItemElement>> {
  count: number;
  getScrollElement: () => TScrollElement | null;
  estimateSize: (index: number) => number;
}

export function useVirtualizer<
  TScrollElement extends Element = Element,
  TItemElement extends Element = Element,
>(options: UseVirtualizerOptions<TScrollElement, TItemElement>) {
  let virtualizer: Virtualizer<TScrollElement, TItemElement> | null = null;
  let _virtualItems: VirtualItem[] = [];
  let _totalSize = 0;
  let _onUpdate: (() => void) | null = null;

  const init = (scrollElement: TScrollElement) => {
    if (virtualizer) return;

    const resolvedOptions: VirtualizerOptions<TScrollElement, TItemElement> = {
      ...options,
      getScrollElement: () => scrollElement,
      observeElementRect: observeElementRect,
      observeElementOffset: observeElementOffset,
      scrollToFn: elementScroll,
      onChange: (instance) => {
        _virtualItems = instance.getVirtualItems();
        _totalSize = instance.getTotalSize();
        _onUpdate?.();
        options.onChange?.(instance);
      },
    };

    virtualizer = new Virtualizer(resolvedOptions);
    virtualizer._willUpdate();

    _virtualItems = virtualizer.getVirtualItems();
    _totalSize = virtualizer.getTotalSize();
  };

  return {
    getVirtualItems: () => _virtualItems,
    getTotalSize: () => _totalSize,
    init,
    setOnUpdate: (fn: () => void) => {
      _onUpdate = fn;
    },
    scrollToIndex: (
      index: number,
      opts?: {
        align?: "start" | "center" | "end" | "auto";
        behavior?: "auto" | "smooth";
      },
    ) => {
      virtualizer?.scrollToIndex(index, opts);
    },
    scrollToOffset: (
      offset: number,
      opts?: {
        align?: "start" | "center" | "end" | "auto";
        behavior?: "auto" | "smooth";
      },
    ) => {
      virtualizer?.scrollToOffset(offset, opts);
    },
    measureElement: (element: TItemElement | null) => {
      if (element && virtualizer) {
        virtualizer.measureElement(element);
      }
    },
    getVirtualizer: () => virtualizer,
    cleanup: () => {
      virtualizer?.cleanup();
      virtualizer = null;
    },
  };
}
