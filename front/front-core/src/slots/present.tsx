import { createEvent, createStore } from "effector";
import type { ComponentType } from "react";
import type { Widget } from "@/plugin/types_actions";
import {
	CHAT_TAB_ID,
	controlPanelOpened,
	tabActivated,
	tabContentRegistered,
	tabRegistered,
} from "../landing-common/control-panel-model";
import { mountWhenReady } from ".";
import { dashboardSlots } from "./dashboard_slots";
import { SlotInline } from "./SlotInline";

// Store для центральной области
export type CenterViewState = {
	view: ComponentType<any>;
	config: any;
} | null;

export const setCenterView = createEvent<CenterViewState>();
export const $centerView = createStore<CenterViewState>(null).on(
	setCenterView,
	(_, view) => view,
);

function oneOf<T>(value: T, ...options: (T[] | T)[]) {
	return options.flat().includes(value);
}

const getDirectSlot = (slot: string | string[]) => {
	if (Array.isArray(slot)) {
		return (
			slot.find(
				(item) => typeof item === "string" && item.startsWith("sidebar:"),
			) || null
		);
	}
	if (typeof slot === "string" && slot.startsWith("sidebar:")) {
		return slot;
	}
	return null;
};

export const present = async (
	widget: Widget<any>,
	slot: string | string[],
	mountParams?: any,
) => {
	console.log("[present] Starting presentation", { widget, slot, mountParams });

	const directSlot = getDirectSlot(slot);

	// Для center — просто обновляем store, без слотов
	if (oneOf("center", slot) && !directSlot) {
		const config = { ...widget.config, ...mountParams };
		setCenterView({ view: widget.view, config });
		return () => setCenterView(null);
	}

	let point = "global:toast";
	console.log("[present] Direct slot:", directSlot);
	if (directSlot) {
		point = directSlot;
	} else {
		if (oneOf("full", slot)) {
			point = "global:toast";
		}
		if (oneOf("left", slot)) {
			point = "sidebar:left";
		}
		if (oneOf("right", slot)) {
			point = "sidebar:right";
		}
		if (oneOf("dashboard", slot)) {
			const widgetId =
				widget.config?.pathCardConfig ||
				widget.config?.tableId ||
				widget.config?.title;
			point = `dashboard:${dashboardSlots.next("pinned", widgetId)}`;
		}
	}

	if (point.startsWith("sidebar:tab:")) {
		const tabId = point.replace("sidebar:tab:", "");
		tabRegistered({
			id: tabId,
			icon: null,
			label: tabId.charAt(0).toUpperCase() + tabId.slice(1),
		});
		tabContentRegistered({ id: tabId, content: <SlotInline slotId={point} /> });
		tabActivated(tabId);
		controlPanelOpened();
	} else if (point === "sidebar:right") {
		tabActivated(CHAT_TAB_ID);
		controlPanelOpened();
	}

	console.log("Present RUN", widget, slot, point);

	const Component = widget.view;
	const res = { ...widget.config };

	const commandHandlers = {};
	if (widget.commands) {
		Object.keys(widget.commands).forEach((commandName) => {
			commandHandlers[commandName] = (payload) => {
				widget.commands[commandName](payload);
			};
		});
	}

	const componentKey = res.instanceKey || res.tableId || point;

	return mountWhenReady(
		<Component
			key={componentKey}
			{...res}
			{...mountParams}
			{...commandHandlers}
		/>,
		point,
	);
};
