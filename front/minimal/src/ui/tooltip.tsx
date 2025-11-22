import { Component } from "@solenopsys/converged-renderer";
import $ from "@solenopsys/converged-reactive";
import {
  computePosition,
  flip,
  shift,
  offset,
  arrow,
  Placement,
} from "@floating-ui/dom";
import { createTooltipMachine } from "../lib/tooltip-machine";
import { cn } from "../lib/utils";

interface TooltipProps {
  children?: any;
  content: string | (() => string);
  placement?: Placement;
  openDelay?: number;
  closeDelay?: number;
  className?: string;
}

const tooltipBase =
  "z-50 w-fit max-w-xs rounded-md px-3 py-1.5 text-xs text-balance bg-foreground text-background";

export const UiTooltip: Component<TooltipProps> = (props) => {
  const isOpen = $(false);
  let triggerEl: HTMLElement | null = null;
  let tooltipEl: HTMLElement | null = null;
  let arrowEl: HTMLElement | null = null;
  let openTimer: number | null = null;
  let closeTimer: number | null = null;

  const machine = createTooltipMachine();

  const clearTimers = () => {
    if (openTimer) {
      clearTimeout(openTimer);
      openTimer = null;
    }
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
  };

  const updatePosition = () => {
    if (!triggerEl || !tooltipEl) return;

    computePosition(triggerEl, tooltipEl, {
      placement: props.placement || "top",
      middleware: [
        offset(8),
        flip(),
        shift({ padding: 5 }),
        ...(arrowEl ? [arrow({ element: arrowEl })] : []),
      ],
    }).then(({ x, y, placement, middlewareData }) => {
      Object.assign(tooltipEl!.style, {
        left: `${x}px`,
        top: `${y}px`,
      });

      if (arrowEl && middlewareData.arrow) {
        const { x: arrowX, y: arrowY } = middlewareData.arrow;
        const staticSide = {
          top: "bottom",
          right: "left",
          bottom: "top",
          left: "right",
        }[placement.split("-")[0]] as string;

        Object.assign(arrowEl.style, {
          left: arrowX != null ? `${arrowX}px` : "",
          top: arrowY != null ? `${arrowY}px` : "",
          right: "",
          bottom: "",
          [staticSide]: "-4px",
        });
      }
    });
  };

  const showTooltip = () => {
    isOpen(true);
    requestAnimationFrame(() => {
      arrowEl = tooltipEl?.querySelector("[data-arrow]") as HTMLElement;
      updatePosition();
    });
  };

  const hideTooltip = () => {
    isOpen(false);
  };

  // Effects based on state changes
  machine.$state.watch((state) => {
    if (state === "opening") {
      clearTimers();
      openTimer = window.setTimeout(() => {
        machine.send("OPEN_DELAY");
      }, props.openDelay ?? 400);
    }

    if (state === "open") {
      clearTimers();
      showTooltip();
    }

    if (state === "closing") {
      closeTimer = window.setTimeout(() => {
        machine.send("CLOSE_DELAY");
      }, props.closeDelay ?? 150);
    }

    if (state === "closed") {
      clearTimers();
      hideTooltip();
    }
  });

  const getContent = () => {
    return typeof props.content === "function"
      ? props.content()
      : props.content;
  };

  return () => {
    return () => (
      <>
        <div
          ref={(el: HTMLElement) => (triggerEl = el)}
          onMouseEnter={() => machine.send("POINTER_ENTER")}
          onMouseLeave={() => machine.send("POINTER_LEAVE")}
          onFocus={() => machine.send("FOCUS")}
          onBlur={() => machine.send("BLUR")}
          data-slot="tooltip-trigger"
          class="inline-block"
        >
          {props.children}
        </div>
        <div
          ref={(el: HTMLElement) => {
            tooltipEl = el;
            arrowEl = el?.querySelector("[data-arrow]") as HTMLElement;
          }}
          role="tooltip"
          data-slot="tooltip-content"
          class={cn(tooltipBase, "absolute", props.className)}
          style={`display: ${isOpen() ? "block" : "none"}; top: 0; left: 0;`}
        >
          {getContent()}
          <div data-arrow class="absolute size-2 bg-foreground rotate-45" />
        </div>
      </>
    );
  };
};

export default UiTooltip;
