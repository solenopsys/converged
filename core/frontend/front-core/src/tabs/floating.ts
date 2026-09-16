import type { ComponentChildren, JSX, RefObject } from "preact";
import { createPortal } from "preact/compat";
import { useLayoutEffect, useState } from "preact/hooks";

// Menus float above the page instead of inside whatever opened them.
//
// A menu positioned inside its trigger's container is clipped by any ancestor
// that scrolls or contains layout — `.surface-content` does both, which is how
// the home screen's "+" list ended up cut off at the first section. So the
// panel is rendered into the root the trigger lives in (the document body, or
// the shadow root when the shell is embedded) and placed against the viewport.

const GAP = 4;
const MARGIN = 8;

/** Where a floating panel goes: the trigger's shadow root, else the body. */
export function floatingRoot(node: Node | null | undefined): Element | null {
	if (!node || typeof document === "undefined") return null;
	const root = node.getRootNode();
	return root instanceof ShadowRoot
		? (root as unknown as Element)
		: document.body;
}

export function Floating({
	anchor,
	children,
}: {
	anchor: RefObject<HTMLElement | null>;
	children: ComponentChildren;
}) {
	const root = floatingRoot(anchor.current);
	return root ? createPortal(children, root) : null;
}

/**
 * Viewport coordinates for a panel under (or, without room, over) its anchor.
 * Follows resizes and every scroll container, so the panel stays attached.
 */
export function useAnchoredPosition(
	anchor: RefObject<HTMLElement | null>,
	open: boolean,
	align: "start" | "end",
	width: number,
): JSX.CSSProperties {
	const [style, setStyle] = useState<JSX.CSSProperties>({});

	useLayoutEffect(() => {
		if (!open) return;
		const place = () => {
			const rect = anchor.current?.getBoundingClientRect();
			if (!rect) return;
			const room = Math.min(width, window.innerWidth - MARGIN * 2);
			const left =
				align === "start"
					? Math.min(rect.left, window.innerWidth - room - MARGIN)
					: rect.right - room;
			const below = window.innerHeight - rect.bottom;
			const above = rect.top;
			const vertical: JSX.CSSProperties =
				below < 240 && above > below
					? { bottom: `${window.innerHeight - rect.top + GAP}px` }
					: { top: `${rect.bottom + GAP}px` };
			setStyle({
				position: "fixed",
				left: `${Math.max(MARGIN, left)}px`,
				maxHeight: `${Math.max(160, Math.min(440, (vertical.top ? below : above) - GAP - MARGIN))}px`,
				...vertical,
			});
		};
		place();
		window.addEventListener("resize", place);
		window.addEventListener("scroll", place, true);
		return () => {
			window.removeEventListener("resize", place);
			window.removeEventListener("scroll", place, true);
		};
	}, [anchor, open, align, width]);

	return style;
}
