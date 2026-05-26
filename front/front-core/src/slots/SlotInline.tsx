import { useUnit } from "effector-react";
import { $slotContents } from "./slots";

/**
 * Renders the current content of a slot inline at the call site.
 * Unlike SlotProvider which uses portals into DOM mount points, this just
 * reads the effector store and inlines the content where placed.
 *
 * Useful when you want to render slot content inside an arbitrary React tree
 * (e.g. inside a panel tab) without relying on global DOM mount points or
 * SlotProvider ownership.
 */
export function SlotInline({ slotId }: { slotId: string }) {
	const contents = useUnit($slotContents);
	const content = contents[slotId];
	return content ? <>{content}</> : null;
}
