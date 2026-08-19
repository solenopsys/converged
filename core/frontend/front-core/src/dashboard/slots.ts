import { createEvent, createStore } from "effector";
import type { ReactNode } from "preact/compat";

export type SlotId = string;

export const slotContentSet = createEvent<{ slotId: SlotId; content: ReactNode }>();
export const slotContentCleared = createEvent<SlotId>();
export const layoutReady = createEvent<string>();

export const $readyLayouts = createStore<Set<string>>(new Set()).on(
	layoutReady,
	(layouts, layoutName) => new Set([...layouts, layoutName]),
);

export const $slotContents = createStore<Record<SlotId, ReactNode>>({})
	.on(slotContentSet, (contents, { slotId, content }) => ({
		...contents,
		[slotId]: content,
	}))
	.on(slotContentCleared, (contents, slotId) => {
		const next = { ...contents };
		delete next[slotId];
		return next;
	});

export const mount = (content: ReactNode, slotId: SlotId): void => {
	slotContentSet({ slotId, content });
};

export const unmount = (slotId: SlotId): void => {
	slotContentCleared(slotId);
};

export const mountWhenReady = (
	content: ReactNode,
	slotId: SlotId,
	options: { layoutName?: string } = {},
): (() => void) => {
	const { layoutName } = options;
	let unwatch: (() => void) | null = null;
	let mounted = false;

	const tryMount = () => {
		if (mounted) return true;

		if (layoutName && !$readyLayouts.getState().has(layoutName)) {
			return false;
		}

		mount(content, slotId);
		mounted = true;
		unwatch?.();
		return true;
	};

	if (tryMount()) {
		return () => unmount(slotId);
	}

	unwatch = $readyLayouts.watch(() => {
		if (!mounted) tryMount();
	});

	return () => {
		unwatch?.();
		if (mounted) unmount(slotId);
	};
};
