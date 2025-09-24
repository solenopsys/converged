import { createEvent, createStore } from "effector";
import { ReactNode } from "react";

export type SlotId = string;

// События
export const slotMounted = createEvent<SlotId>();
export const slotUnmounted = createEvent<SlotId>();
export const componentMounted = createEvent<{ slotId: SlotId; component: ReactNode }>();
export const layoutReady = createEvent<string>(); // "global", "dashboard", etc.
export const slotsReady = createEvent(); // все базовые слоты готовы

export const $readyLayouts = createStore<Set<string>>(new Set())
  .on(layoutReady, (layouts, layoutName) => new Set([...layouts, layoutName]));

// Store общей готовности
export const $slotsReady = createStore<boolean>(false)
  .on(slotsReady, () => true);

// Store активных слотов
export const $activeSlots = createStore<Set<SlotId>>(new Set())
  .on(slotMounted, (slots, slotId) => {
    console.log("Slot mounted:", slotId);
    return new Set([...slots, slotId]);
  })
  .on(slotUnmounted, (slots, slotId) => {
    const newSlots = new Set(slots);
    newSlots.delete(slotId);
    return newSlots;
  });

// Store контента в слотах - один компонент на слот
export const $slotContents = createStore<Record<SlotId, ReactNode>>({})
  .on(componentMounted, (contents, { slotId, component }) => ({
    ...contents,
    [slotId]: component  // Просто заменяем компонент
  }))
  .on(slotUnmounted, (contents, slotId) => {
    const newContents = { ...contents };
    delete newContents[slotId];
    return newContents;
  });

// Главная функция - монтирование компонента в слот
export const mount = (component: ReactNode, slotId: SlotId): void => {
  const activeSlots = $activeSlots.getState();
  
  if (!activeSlots.has(slotId)) {
    console.warn(`Slot "${slotId}" not found. Available slots:`, Array.from(activeSlots));
    return;
  }
  
  componentMounted({ slotId, component });
};

// Функция - монтирование с ожиданием готовности лайаута
export const mountWhenReady = (
  component: ReactNode, 
  slotId: SlotId, 
  options: {
    layoutName?: string;
  } = {}
): (() => void) => {
  console.log("Mount when ready", component, slotId, options);
  const { layoutName } = options;
  let unwatchReady: (() => void) | null = null;
  let unwatchSlots: (() => void) | null = null;
  let mounted = false;
  
  const tryMount = () => {
    if (mounted) return true;
    
    const readyLayouts = $readyLayouts.getState();
    const activeSlots = $activeSlots.getState();
    
    // Проверяем готовность лайаута (если указан)
    if (layoutName && !readyLayouts.has(layoutName)) {
      return false;
    }
    
    // Проверяем существование слота
    if (!activeSlots.has(slotId)) {
      return false;
    }
    
    // Всё готово - монтируем
    mount(component, slotId);
    mounted = true;
    
    // Отписываемся от всех watch'еров
    unwatchReady?.();
    unwatchSlots?.();
    
    return true;
  };
  
  // Пробуем смонтировать сразу
  if (tryMount()) {
    return () => {}; // Нечего размонтировать, React сам управляет
  }
  
  // Если не получилось - подписываемся на изменения
  unwatchReady = $readyLayouts.watch(tryMount);
  unwatchSlots = $activeSlots.watch(tryMount);
  
  // Возвращаем функцию отписки от watch'еров
  return () => {
    unwatchReady?.();
    unwatchSlots?.();
  };
};

// Поиск слотов по паттерну
export const findSlots = (pattern: string): SlotId[] => {
  const slots = Array.from($activeSlots.getState());
  const regex = new RegExp(pattern.replace('*', '.*'));
  return slots.filter(slotId => regex.test(slotId));
};