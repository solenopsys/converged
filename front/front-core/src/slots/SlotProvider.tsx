import { ReactNode, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useUnit } from "effector-react";
import { $slotContents, layoutReady } from "./slots";

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

const SLOT_PROVIDER_OWNER_KEY = "__front_core_slot_provider_owner__";

function resolveMountPointId(slotId: string): string {
  if (slotId === "sidebar:tab" || slotId.startsWith("sidebar:tab:")) {
    return "slot-panel-tab";
  }
  return SLOT_MOUNT_POINTS[slotId] || slotId;
}

/**
 * SlotPortal - рендерит контент слота в DOM элемент через portal
 */
function SlotPortal({ slotId, content }: { slotId: string; content: ReactNode }) {
  const mountPointId = resolveMountPointId(slotId);
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
  const ownerIdRef = useRef(`slot-provider-${Math.random().toString(36).slice(2)}`);
  const [isOwner, setIsOwner] = useState(false);

  useLayoutEffect(() => {
    layoutReady("global");
  }, []);

  useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const win = window as Window & { [SLOT_PROVIDER_OWNER_KEY]?: string };
    if (!win[SLOT_PROVIDER_OWNER_KEY]) {
      win[SLOT_PROVIDER_OWNER_KEY] = ownerIdRef.current;
      setIsOwner(true);
    } else {
      setIsOwner(win[SLOT_PROVIDER_OWNER_KEY] === ownerIdRef.current);
    }

    return () => {
      if (win[SLOT_PROVIDER_OWNER_KEY] === ownerIdRef.current) {
        delete win[SLOT_PROVIDER_OWNER_KEY];
      }
    };
  }, []);

  return (
    <>
      {children}
      {/* Порталы для всех активных слотов */}
      {isOwner
        ? Object.entries(slotContents).map(([slotId, content]) => (
            <SlotPortal key={slotId} slotId={slotId} content={content} />
          ))
        : null}
    </>
  );
}
