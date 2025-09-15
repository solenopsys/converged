import { useUnit } from "effector-react";
import { useEffect } from "react";
import { slotMounted, slotUnmounted, $slotContents, SlotId } from "./slots";

export function Slot({ id }: { id: SlotId }) {
  const contents = useUnit($slotContents);
  
  useEffect(() => {
    slotMounted(id);
    return () => slotUnmounted(id);
  }, [id]);
  
  const slotContent = contents[id];
  
  return slotContent || null;
}