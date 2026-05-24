import { useEffect, useRef, useState } from "react";
import { $controlPanelMode } from "./control-panel-model";

function findScrollParent(el: HTMLElement): HTMLElement | Window {
  let node: HTMLElement | null = el.parentElement;
  while (node && node !== document.body) {
    const { overflow, overflowY } = window.getComputedStyle(node);
    if (/auto|scroll/.test(overflow + overflowY)) return node;
    node = node.parentElement;
  }
  return window;
}

const DOCK_THRESHOLD = 52;
const UNDOCK_THRESHOLD = 62;

function canDockHeroInput(): boolean {
  const controlPanelRoot = document.getElementById("ssr-control-panel-root");
  if ($controlPanelMode.getState() === "app") return false;
  return Boolean(controlPanelRoot || document.querySelector(".hero-scroll-layout__topbar"));
}

export function useHeroDock() {
  const slotRef = useRef<HTMLDivElement>(null);
  const [docked, setDocked] = useState(false);

  useEffect(() => {
    const slot = slotRef.current;
    if (!slot || typeof window === "undefined") return;

    let frame = 0;
    const scrollParent = findScrollParent(slot);

    const measure = () => {
      frame = 0;
      if (!canDockHeroInput()) {
        setDocked(false);
        return;
      }
      const top = slot.getBoundingClientRect().top;
      setDocked((was) => top <= (was ? UNDOCK_THRESHOLD : DOCK_THRESHOLD));
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };

    measure();
    scrollParent.addEventListener("scroll", schedule, { passive: true } as AddEventListenerOptions);
    window.addEventListener("resize", schedule);
    const modeUnwatch = $controlPanelMode.watch(schedule);

    return () => {
      scrollParent.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      modeUnwatch();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.heroInputDocked = docked ? "1" : "0";
    return () => { delete document.documentElement.dataset.heroInputDocked; };
  }, [docked]);

  return { slotRef, docked };
}
