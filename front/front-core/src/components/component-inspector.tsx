import { useEffect, useState } from "react";

interface ComponentInfo {
  name: string;
  source: "front-core" | "local";
}

function getComponentInfo(element: Element, known: Set<Function>): ComponentInfo | null {
  const fiberKey = Object.keys(element).find((k) => k.startsWith("__reactFiber$"));
  if (!fiberKey) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fiber = (element as any)[fiberKey];

  while (fiber) {
    if (fiber.type && typeof fiber.type === "function") {
      const name: string = fiber.type.displayName || fiber.type.name || "";
      if (name && name !== "Anonymous" && !/^[a-z]/.test(name)) {
        return { name, source: known.has(fiber.type) ? "front-core" : "local" };
      }
    }
    fiber = fiber.return;
  }

  return null;
}

interface Tooltip {
  x: number;
  y: number;
  info: ComponentInfo;
}

function Inspector({ known }: { known: Set<Function> }) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      let target = document.elementFromPoint(e.clientX, e.clientY);
      let info: ComponentInfo | null = null;

      while (target && !info) {
        info = getComponentInfo(target, known);
        target = target.parentElement;
      }

      setTooltip(info ? { x: e.clientX, y: e.clientY, info } : null);
    };

    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <>
      {tooltip && (
        <div
          style={{
            position: "fixed",
            left: tooltip.x + 2,
            top: tooltip.y + 2,
            background: tooltip.info.source === "front-core"
              ? "oklch(0.25 0.08 145)"
              : "oklch(0.25 0.08 30)",
            border: `1px solid ${tooltip.info.source === "front-core" ? "oklch(0.5 0.15 145)" : "oklch(0.5 0.15 30)"}`,
            color: "oklch(0.95 0 0)",
            padding: "2px 8px",
            borderRadius: 4,
            fontSize: 12,
            zIndex: 10000,
            pointerEvents: "none",
            fontFamily: "monospace",
            boxShadow: "0 4px 12px oklch(0% 0 0 / 20%)",
          }}
        >
          {tooltip.info.name}
        </div>
      )}
    </>
  );
}

export function ComponentInspector({ known }: { known: Set<Function> }) {
  if (import.meta.env?.PROD) return null;
  return <Inspector known={known} />;
}
