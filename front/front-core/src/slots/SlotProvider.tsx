import { ReactNode, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useUnit } from "effector-react";
import { $slotContents, layoutReady } from "./slots";
import { $activeTab } from "sidebar-controller";

/**
 * Маппинг slotId -> DOM element id
 * SlotProvider монтирует контент слотов в существующие DOM элементы по id
 */
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

/**
 * SlotPortal - рендерит контент слота в DOM элемент через portal
 */
function SlotPortal({ slotId, content }: { slotId: string; content: ReactNode }) {
  const mountPointId =
    slotId.startsWith("sidebar:tab:")
      ? "slot-panel-tab"
      : SLOT_MOUNT_POINTS[slotId] || slotId;
  const element = document.getElementById(mountPointId);

  if (!element) {
    console.warn(`[SlotPortal] Mount point not found: #${mountPointId} for slot ${slotId}`);
    return null;
  }

  return createPortal(content, element);
}

/**
 * SlotProvider - контейнер состояния слотов
 *
 * НЕ определяет структуру страницы - только монтирует контент в существующие DOM элементы.
 * Layout рендерится на SSR с фиксированными id блоками.
 * SlotProvider монтирует SPA контент в эти блоки через portals.
 */
export function SlotProvider({ children }: { children?: ReactNode }) {
  const slotContents = useUnit($slotContents);
  const activeTab = useUnit($activeTab);

  useLayoutEffect(() => {
    layoutReady("global");
  }, []);

  const visibleSlots = Object.entries(slotContents).filter(([slotId]) => {
    if (!slotId.startsWith("sidebar:tab:")) {
      return true;
    }

    if (!activeTab || activeTab === "menu") {
      return false;
    }

    const tabId = slotId.slice("sidebar:tab:".length);
    return tabId === activeTab;
  });

  return (
    <>
      {children}
      {/* Порталы для всех активных слотов */}
      {visibleSlots.map(([slotId, content]) => (
        <SlotPortal key={slotId} slotId={slotId} content={content} />
      ))}
    </>
  );
}
