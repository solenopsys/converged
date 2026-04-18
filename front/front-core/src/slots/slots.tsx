import { createEvent, createStore } from "effector";
import { ReactNode } from "react";

export type SlotId = string;

const SLOT_MOUNT_POINTS: Record<string, string> = {
  "sidebar:center": "slot-center",
  "sidebar:left": "slot-panel-menu",
  "sidebar:tabs": "slot-tabs",
  "sidebar:input": "slot-input",
  "sidebar:right": "slot-panel-chat",
  "global:modal": "slot-modal",
  "global:toast": "slot-toast",
  "global:overlay": "slot-overlay",
};

function resolveMountPointId(slotId: SlotId): string {
  if (slotId === "sidebar:tab" || slotId.startsWith("sidebar:tab:")) {
    return "slot-panel-tab";
  }
  return SLOT_MOUNT_POINTS[slotId] || slotId;
}

function normalizeSlotId(slotId: SlotId): SlotId {
  if (slotId.startsWith("sidebar:tab:")) {
    return "sidebar:tab";
  }
  return slotId;
}

function hasContentForMountPoint(
  contents: Record<SlotId, ReactNode>,
  mountPointId: string,
): boolean {
  return Object.keys(contents).some(
    (existingSlotId) => resolveMountPointId(existingSlotId) === mountPointId,
  );
}

// События
export const slotContentSet = createEvent<{ slotId: SlotId; content: ReactNode }>();
export const slotContentCleared = createEvent<SlotId>();
export const layoutReady = createEvent<string>();

// Store готовых layouts
export const $readyLayouts = createStore<Set<string>>(new Set())
  .on(layoutReady, (layouts, layoutName) => new Set([...layouts, layoutName]));

// Store контента слотов
export const $slotContents = createStore<Record<SlotId, ReactNode>>({})
  .on(slotContentSet, (contents, { slotId, content }) => ({
    ...contents,
    [slotId]: content,
  }))
  .on(slotContentCleared, (contents, slotId) => {
    const next = { ...contents };
    delete next[slotId];
    return next;
  });

/**
 * Монтирует контент в слот
 * SlotProvider отрендерит его через portal в соответствующий DOM элемент
 */
export const mount = (content: ReactNode, slotId: SlotId): void => {
  console.log(`[slots] mount to ${slotId}`);
  const normalizedSlotId = normalizeSlotId(slotId);
  const mountPointId = resolveMountPointId(normalizedSlotId);
  const existingContent = hasContentForMountPoint(
    $slotContents.getState(),
    mountPointId,
  );

  if (!existingContent && typeof document !== "undefined") {
    const mountPoint = document.getElementById(mountPointId);
    if (mountPoint) {
      mountPoint.replaceChildren();
    }
  }
  slotContentSet({ slotId: normalizedSlotId, content });
};

/**
 * Очищает контент слота
 */
export const unmount = (slotId: SlotId): void => {
  console.log(`[slots] unmount ${slotId}`);
  slotContentCleared(normalizeSlotId(slotId));
};

/**
 * Монтирует контент когда layout готов
 */
export const mountWhenReady = (
  content: ReactNode,
  slotId: SlotId,
  options: { layoutName?: string } = {}
): (() => void) => {
  const { layoutName } = options;
  let unwatch: (() => void) | null = null;
  let mounted = false;

  const tryMount = () => {
    if (mounted) return true;

    if (layoutName) {
      const readyLayouts = $readyLayouts.getState();
      if (!readyLayouts.has(layoutName)) {
        return false;
      }
    }

    mount(content, slotId);
    mounted = true;
    unwatch?.();
    return true;
  };

  if (tryMount()) {
    return () => unmount(slotId);
  }

  unwatch = $readyLayouts.watch(() => {
    if (!mounted) tryMount();
  });

  return () => {
    unwatch?.();
    if (mounted) unmount(slotId);
  };
};
