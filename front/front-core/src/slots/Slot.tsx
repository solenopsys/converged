import { useUnit } from "effector-react";
import { $slotContents, SlotId } from "./slots";

/**
 * @deprecated Use SlotProvider with portal-based mounting instead.
 * This component renders slot content inline - use only for backwards compatibility.
 */
export function Slot({ id }: { id: SlotId; preserveContent?: boolean }) {
  const contents = useUnit($slotContents);
  return contents[id] || null;
}
