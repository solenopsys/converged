"use client";

import React, { useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import { cn } from "../../../lib/utils";

type ColumnResizerProps = {
  onResize: (columnIndex: number, nextWidth: number) => void;
  currentWidth: number;
  columnIndex: number;
};

export function ColumnResizer({
  onResize,
  currentWidth,
  columnIndex,
}: ColumnResizerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const latestXRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    const targetElement = event.currentTarget;
    targetElement.setPointerCapture(event.pointerId);

    setIsDragging(true);
    startXRef.current = event.clientX;
    startWidthRef.current = currentWidth;
    latestXRef.current = event.clientX;
    pointerIdRef.current = event.pointerId;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      latestXRef.current = moveEvent.clientX;

      if (animationFrameRef.current === null) {
        animationFrameRef.current = requestAnimationFrame(() => {
          const deltaX = latestXRef.current - startXRef.current;
          onResize(columnIndex, startWidthRef.current + deltaX);
          animationFrameRef.current = null;
        });
      }
    };

    const handlePointerUp = () => {
      setIsDragging(false);

      const deltaX = latestXRef.current - startXRef.current;
      onResize(columnIndex, startWidthRef.current + deltaX);

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      if (pointerIdRef.current !== null) {
        targetElement.releasePointerCapture(pointerIdRef.current);
        pointerIdRef.current = null;
      }

      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp, { once: true });
  };

  return (
    <div
      className={cn(
        "absolute right-0 top-0 h-full w-2 cursor-col-resize touch-none group/resizer hover:bg-primary/20",
        isDragging && "bg-primary/50",
      )}
      onPointerDown={handlePointerDown}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover/resizer:opacity-100">
        <GripVertical size={14} className="text-primary" />
      </div>
    </div>
  );
}
