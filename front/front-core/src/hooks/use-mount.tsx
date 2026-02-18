// hooks/useSlotMount.tsx - Основной хук для монтирования в слоты
import { useEffect } from "react";
import { useUnit } from "effector-react";
import { mount, $readyLayouts, type SlotId } from "../slots";
import { ReactNode } from "react";

export function useSlotMount(
  component: ReactNode, 
  slotId: SlotId, 
  options: {
    priority?: number;
    layoutName?: string; // если нужно ждать готовности конкретного лайаута
  } = {}
) {
  const { priority = 0, layoutName } = options;
  const readyLayouts = useUnit($readyLayouts);
  
  useEffect(() => {
    // Если указан layoutName - ждем его готовности
    if (layoutName && !readyLayouts.has(layoutName)) {
      return;
    }
    
    // Монтируем компонент
    const unmount = mount(component, slotId, priority);
    return unmount;
  }, [component, slotId, priority, layoutName, readyLayouts]);
}