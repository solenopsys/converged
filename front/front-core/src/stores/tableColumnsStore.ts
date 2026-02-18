import { createStore, createEvent, sample } from 'effector';

export interface TableColumnsState {
  // Ключ - tableId, значение - массив ширин колонок [300, 200, 150, ...]
  columnWidths: Record<string, number[]>;
}

// События
export const setColumnWidths = createEvent<{ tableId: string; widths: number[] }>();
export const setColumnWidthAtIndex = createEvent<{ tableId: string; index: number; width: number }>();
export const resetColumnWidths = createEvent<{ tableId: string }>();

// Стор
export const $tableColumnsState = createStore<TableColumnsState>({
  columnWidths: {}
});

// Установка всего массива ширин
sample({
  clock: setColumnWidths,
  source: $tableColumnsState,
  fn: (state, { tableId, widths }) => {
    return {
      ...state,
      columnWidths: {
        ...state.columnWidths,
        [tableId]: widths
      }
    };
  },
  target: $tableColumnsState
});

// Обновление ширины одной колонки по индексу
sample({
  clock: setColumnWidthAtIndex,
  source: $tableColumnsState,
  fn: (state, { tableId, index, width }) => {
    const currentWidths = state.columnWidths[tableId] || [];
    const newWidths = [...currentWidths];
    newWidths[index] = Math.max(50, width); // Минимальная ширина 50px

    return {
      ...state,
      columnWidths: {
        ...state.columnWidths,
        [tableId]: newWidths
      }
    };
  },
  target: $tableColumnsState
});

// Сброс ширин колонок
sample({
  clock: resetColumnWidths,
  source: $tableColumnsState,
  fn: (state, { tableId }) => {
    const { [tableId]: _, ...rest } = state.columnWidths;
    return {
      ...state,
      columnWidths: rest
    };
  },
  target: $tableColumnsState
});

// Селекторы
export const getTableColumnWidths = (tableId: string) => {
  return (state: TableColumnsState) => {
    return state.columnWidths[tableId] || [];
  };
};
