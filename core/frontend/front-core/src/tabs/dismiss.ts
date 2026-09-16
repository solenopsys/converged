import type { RefObject } from "preact";
import { useEffect } from "preact/hooks";

/**
 * Reports a click outside every one of `refs` or an Escape while a menu is
 * open. The only piece of a menu that is about the DOM rather than its state,
 * so it is the only piece that stays a hook. Several refs because a menu
 * rendered through a portal lives apart from its trigger.
 */
export function useDismiss(
	refs:
		| RefObject<HTMLElement | null>
		| readonly RefObject<HTMLElement | null>[],
	open: boolean,
	dismiss: () => void,
): void {
	useEffect(() => {
		if (!open) return;
		const inside = Array.isArray(refs) ? refs : [refs];

		const onPointerDown = (event: PointerEvent) => {
			// `composedPath` sees through a shadow root, where `target` is retargeted.
			const path = event.composedPath();
			const hit = inside.some(
				(ref) => ref.current && path.includes(ref.current),
			);
			if (!hit) dismiss();
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") dismiss();
		};

		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [open, dismiss, refs]);
}
