import { useUnit } from "effector-preact";
import { $slotContents, type SlotId } from "./slots";

export function Slot({ id }: { id: SlotId }) {
	const contents = useUnit($slotContents);
	return contents[id] || null;
}
