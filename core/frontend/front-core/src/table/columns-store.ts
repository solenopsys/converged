import { createStore, createEvent, sample } from 'effector';

export interface TableColumnsState {
  columnWidths: Record<string, number[]>;
}

export const setColumnWidths = createEvent<{ tableId: string; widths: number[] }>();
export const setColumnWidthAtIndex = createEvent<{ tableId: string; index: number; width: number }>();
export const resetColumnWidths = createEvent<{ tableId: string }>();

export const $tableColumnsState = createStore<TableColumnsState>({
  columnWidths: {}
});

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

sample({
  clock: setColumnWidthAtIndex,
  source: $tableColumnsState,
  fn: (state, { tableId, index, width }) => {
    const currentWidths = state.columnWidths[tableId] || [];
    const newWidths = [...currentWidths];
    newWidths[index] = Math.max(50, width);
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

export const getTableColumnWidths = (tableId: string) => {
  return (state: TableColumnsState) => {
    return state.columnWidths[tableId] || [];
  };
};
