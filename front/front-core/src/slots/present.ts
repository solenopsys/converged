import { createDomain, createEvent } from "effector";
import type { ComponentType } from "react";
import type { Widget } from "../plugin/types_actions";

const domain = createDomain("present");

// Types
export type ViewInstance = {
	id: string;
	view: ComponentType<Record<string, unknown>>;
	config?: Record<string, unknown>;
	commands?: Record<string, (p: unknown) => void>;
	placement: string;
};

export type CenterViewState = {
	view: ComponentType<Record<string, unknown>>;
	config?: Record<string, unknown>;
} | null;

// Events
export const presentView = createEvent<ViewInstance>("PRESENT_VIEW");
export const closeView = createEvent<string>("CLOSE_VIEW");
export const setCenterView = createEvent<CenterViewState>("SET_CENTER_VIEW");

// Generate unique id
let viewCounter = 0;
function generateViewId(placement: string): string {
	return `${placement}-${++viewCounter}`;
}

// Store for active views by placement
export const $activeViews = domain
	.createStore<Record<string, ViewInstance>>({})
	.on(presentView, (views, instance) => ({
		...views,
		[instance.placement]: instance,
	}))
	.on(setCenterView, (views, centerView) => {
		if (!centerView) {
			const { center: _, ...rest } = views;
			return rest;
		}

		return {
			...views,
			center: {
				id: generateViewId("center"),
				view: centerView.view,
				config: centerView.config,
				placement: "center",
			},
		};
	})
	.on(closeView, (views, placement) => {
		const { [placement]: _, ...rest } = views;
		return rest;
	});

// Derived stores for specific placements
export const $centerView = $activeViews.map((views) => views.center || null);
export const $sidebarView = $activeViews.map((views) => views.sidebar || null);

// Parse placement string
function parsePlacement(placement: string | string[] | null): string {
	if (!placement) return "center";
	const placementStr = Array.isArray(placement) ? placement[0] : placement;

	// "sidebar:tab:dag" → "sidebar"
	// "center" → "center"
	const parts = placementStr.split(":");
	return parts[0];
}

// Main present function
export function present<V>(
	widget: Widget<V>,
	placement: string | string[] | null,
	params?: Record<string, unknown>,
): void {
	const target = parsePlacement(placement);

	console.log("[present] target:", target, "widget:", widget);

	const instance: ViewInstance = {
		id: generateViewId(target),
		view: widget.view as ComponentType<Record<string, unknown>>,
		config: { ...widget.config, ...params },
		commands: widget.commands as
			| Record<string, (p: unknown) => void>
			| undefined,
		placement: target,
	};

	presentView(instance);
}
