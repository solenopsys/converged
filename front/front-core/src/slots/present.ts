import { createDomain, createStore, createEvent, sample } from "effector";
import type { ComponentType } from "react";
import type { Widget } from "../plugin/types_actions";

const domain = createDomain("present");

// Types
export type ViewInstance = {
  id: string;
  view: ComponentType<any>;
  config?: any;
  commands?: Record<string, (p: any) => void>;
  placement: string;
};

// Events
export const presentView = createEvent<ViewInstance>("PRESENT_VIEW");
export const closeView = createEvent<string>("CLOSE_VIEW");

// Store for active views by placement
export const $activeViews = domain.createStore<Record<string, ViewInstance>>({})
  .on(presentView, (views, instance) => ({
    ...views,
    [instance.placement]: instance,
  }))
  .on(closeView, (views, placement) => {
    const { [placement]: _, ...rest } = views;
    return rest;
  });

// Derived stores for specific placements
export const $centerView = $activeViews.map(views => views["center"] || null);
export const $sidebarView = $activeViews.map(views => views["sidebar"] || null);

// Parse placement string
function parsePlacement(placement: string | string[] | null): string {
  if (!placement) return "center";
  const placementStr = Array.isArray(placement) ? placement[0] : placement;

  // "sidebar:tab:dag" → "sidebar"
  // "center" → "center"
  const parts = placementStr.split(":");
  return parts[0];
}

// Generate unique id
let viewCounter = 0;
function generateViewId(placement: string): string {
  return `${placement}-${++viewCounter}`;
}

// Main present function
export function present<V>(widget: Widget<V>, placement: string | string[] | null, params?: any): void {
  const target = parsePlacement(placement);

  console.log("[present] target:", target, "widget:", widget);

  const instance: ViewInstance = {
    id: generateViewId(target),
    view: widget.view as ComponentType<any>,
    config: { ...widget.config, ...params },
    commands: widget.commands,
    placement: target,
  };

  presentView(instance);
}
