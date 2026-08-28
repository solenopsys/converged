import { useEffect, useRef, useState } from "preact/hooks";


/**
 * Open state plus outside-click / Escape dismissal, shared by every shell
 * popover. Attach `ref` to the element that must not close the popover when
 * clicked — for detached (fixed) menus that is a `display: contents` wrapper
 * holding both trigger and list.
 */
export function usePopover<T extends HTMLElement>() {
	const ref = useRef<T | null>(null);
	const [open, setOpen] = useState(false);

	useEffect(() => {
		if (!open) return;

		const onPointerDown = (event: PointerEvent) => {
			if (!ref.current?.contains(event.target as Node)) setOpen(false);
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false);
		};

		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [open]);

	return { ref, open, setOpen };
}
