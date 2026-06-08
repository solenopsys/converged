/**
 * Sales Island — hydration island for the SSR-rendered SalesIsland.
 *
 * No React / no re-render: it attaches to the existing static DOM and drives the
 * open/closed state through the SAME effector model the React component uses
 * (`createSalesIslandModel`). The store watcher reflects state onto `data-open`;
 * the markup's CSS does the rest. This keeps "state lives in effector" true on
 * both the React and the SSR-hydrated paths.
 */

import { createSalesIslandModel } from "front-core";

type Props = {
	defaultExpanded?: boolean;
};

export function mount(
	container: HTMLElement,
	rawProps: Record<string, unknown>,
): void {
	const props = rawProps as Props;
	const root =
		container.querySelector<HTMLElement>(".sales-island") ?? container;

	const model = createSalesIslandModel(Boolean(props.defaultExpanded));

	const toggleButton = root.querySelector<HTMLElement>(
		"[data-sales-island-toggle]",
	);

	const render = (open: boolean) => {
		root.dataset.open = open ? "true" : "false";
		if (toggleButton)
			toggleButton.setAttribute("aria-expanded", open ? "true" : "false");
	};

	model.$open.watch(render);

	bindAll(root, "[data-sales-island-toggle]", () => model.toggled());
	bindAll(root, "[data-sales-island-open]", () => model.opened());
	bindAll(root, "[data-sales-island-close]", () => model.closed());
	bindAll(root, "[data-sales-island-scrim]", () => model.closed());

	root.addEventListener("keydown", (event) => {
		if (event.key === "Escape" && model.$open.getState()) model.closed();
	});
}

function bindAll(
	root: HTMLElement,
	selector: string,
	handler: () => void,
): void {
	for (const el of root.querySelectorAll<HTMLElement>(selector)) {
		el.addEventListener("click", (event) => {
			event.preventDefault();
			handler();
		});
	}
}
