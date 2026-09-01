import { createEvent, createStore, sample } from "effector";
import {
	$rightPanelEvents,
	$rightPanelTab,
	$rightSidebarState,
	$rightSidebarWidth,
	rightPanelEventRecorded,
	rightPanelTabActivated,
	sidebarCollapsed,
	sidebarExpanded,
	sidebarToggled,
	sidebarWidthChanged,
} from "sidebar-controller/store";

export const panelOpened = createEvent();
export const panelClosed = createEvent();
export const panelToggled = createEvent();
export const panelWidthChanged = createEvent<number>();
export const panelResizeStarted = createEvent();
export const panelResizeFinished = createEvent();

sample({
	clock: panelOpened,
	fn: () => "right" as const,
	target: sidebarExpanded,
});

sample({
	clock: panelClosed,
	fn: () => "right" as const,
	target: sidebarCollapsed,
});

sample({
	clock: panelToggled,
	fn: () => "right" as const,
	target: sidebarToggled,
});

sample({
	clock: panelWidthChanged,
	fn: (width) => ({ side: "right" as const, width }),
	target: sidebarWidthChanged,
});

export const $panelOpen = $rightSidebarState.map(
	(state) => state === "expanded",
);
export const $panelWidth = $rightSidebarWidth;
export const $panelResizing = createStore(false)
	.on(panelResizeStarted, () => true)
	.on(panelResizeFinished, () => false);
export {
	$rightPanelEvents as $panelEvents,
	$rightPanelTab as $panelTab,
	rightPanelEventRecorded as panelEventRecorded,
	rightPanelTabActivated as panelTabActivated,
};

export const pageScrolled = createEvent<{ offset: number; viewport: number }>();

const $heroInView = createStore(true).on(
	pageScrolled,
	(inView, { offset, viewport }) => {
		if (inView && offset > viewport * 0.35) return false;
		if (!inView && offset < viewport * 0.2) return true;
		return inView;
	},
);

export type ComposerPlacement = "hero" | "floating" | "panel";

export const surfacePresenceChanged = createEvent<boolean>();

const $surfaceActive = createStore(false).on(
	surfacePresenceChanged,
	(_, active) => active,
);

export const $composerPlacement = sample({
	source: { open: $panelOpen, hero: $heroInView, surface: $surfaceActive },
	fn: ({ open, hero, surface }): ComposerPlacement => {
		if (open) return "panel";
		return hero && !surface ? "hero" : "floating";
	},
});

export const draftChanged = createEvent<string>();
export const draftCleared = createEvent();

export const $draft = createStore("")
	.on(draftChanged, (_, value) => value)
	.reset(draftCleared);

sample({
	clock: draftChanged,
	fn: () => "chat" as const,
	target: rightPanelTabActivated,
});
