import { createEffect, createEvent, createStore, sample } from "effector";

export interface TableColumnsState {
	columnWidths: Record<string, number[]>;
}

const STORAGE_KEY = "front-core:table-column-widths";

export const setColumnWidths = createEvent<{
	tableId: string;
	widths: number[];
}>();
export const setColumnWidthAtIndex = createEvent<{
	tableId: string;
	index: number;
	width: number;
}>();
export const resetColumnWidths = createEvent<{ tableId: string }>();
export const columnWidthsRestored = createEvent<TableColumnsState>();

function storage(): Storage | null {
	try {
		return typeof localStorage === "undefined" ? null : localStorage;
	} catch {
		return null;
	}
}

function parseState(raw: string | null): TableColumnsState {
	try {
		const parsed: unknown = JSON.parse(raw ?? "{}");
		if (!parsed || typeof parsed !== "object") return { columnWidths: {} };
		const source = (parsed as { columnWidths?: unknown }).columnWidths;
		if (!source || typeof source !== "object" || Array.isArray(source))
			return { columnWidths: {} };

		const columnWidths: Record<string, number[]> = {};
		for (const [tableId, widths] of Object.entries(source)) {
			if (
				Array.isArray(widths) &&
				widths.every(
					(width) => typeof width === "number" && Number.isFinite(width),
				)
			) {
				columnWidths[tableId] = widths;
			}
		}
		return { columnWidths };
	} catch {
		return { columnWidths: {} };
	}
}

function readState(): TableColumnsState {
	try {
		return parseState(storage()?.getItem(STORAGE_KEY) ?? null);
	} catch {
		return { columnWidths: {} };
	}
}

export const $tableColumnsState = createStore<TableColumnsState>(readState(), {
	name: "TABLE_COLUMNS_STATE",
})
	.on(setColumnWidths, (state, { tableId, widths }) => ({
		...state,
		columnWidths: { ...state.columnWidths, [tableId]: [...widths] },
	}))
	.on(setColumnWidthAtIndex, (state, { tableId, index, width }) => {
		const newWidths = [...(state.columnWidths[tableId] ?? [])];
		newWidths[index] = Math.max(50, width);
		return {
			...state,
			columnWidths: { ...state.columnWidths, [tableId]: newWidths },
		};
	})
	.on(resetColumnWidths, (state, { tableId }) => {
		const { [tableId]: _, ...columnWidths } = state.columnWidths;
		return { ...state, columnWidths };
	})
	.on(columnWidthsRestored, (_, state) => state);

export const persistTableColumnWidthsFx = createEffect(
	(state: TableColumnsState) => {
		try {
			const store = storage();
			if (!store) return;
			const serialized = JSON.stringify(state);
			if (store.getItem(STORAGE_KEY) !== serialized)
				store.setItem(STORAGE_KEY, serialized);
		} catch {
			// Storage can be disabled by browser policy; table state remains usable in memory.
		}
	},
);

sample({
	clock: $tableColumnsState.updates,
	target: persistTableColumnWidthsFx,
});

if (typeof window !== "undefined") {
	window.addEventListener("storage", (event) => {
		if (event.key === STORAGE_KEY || event.key === null)
			columnWidthsRestored(
				parseState(event.key === null ? null : event.newValue),
			);
	});
}

export const getTableColumnWidths = (tableId: string) => {
	return (state: TableColumnsState) => state.columnWidths[tableId] || [];
};
