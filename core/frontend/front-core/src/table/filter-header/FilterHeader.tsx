import type { ColumnConfig } from "../types";
import { FilterCell } from "./FilterCell";
import type { TableFilterConfig, TableFilterValues } from "./types";

export type FilterHeaderProps<TData extends object> = {
	columns: readonly ColumnConfig<TData>[];
	widths: readonly number[];
	filters: readonly TableFilterConfig[];
	values: TableFilterValues;
	onChange: (values: TableFilterValues) => void;
	selectionOffset?: number;
};

function nextValues(
	values: TableFilterValues,
	id: string,
	value: string | string[],
): TableFilterValues {
	const next = { ...values };
	if (value === "" || (Array.isArray(value) && value.length === 0)) {
		delete next[id];
	} else {
		next[id] = value;
	}
	return next;
}

export function FilterHeader<TData extends object>({
	columns,
	widths,
	filters,
	values,
	onChange,
	selectionOffset = 0,
}: FilterHeaderProps<TData>) {
	const filterByColumn = new Map(filters.map((filter) => [filter.id, filter]));
	const visibleFilterCount = columns.filter((column) =>
		filterByColumn.has(column.id),
	).length;
	if (visibleFilterCount === 0) return null;

	return (
		<div className="sticky top-0 z-20 flex h-10 border-b bg-background/95">
			{selectionOffset > 0 && (
				<div style={{ width: `${selectionOffset}px`, flexShrink: 0 }} />
			)}
			{columns.map((column, index) => {
				const filter = filterByColumn.get(column.id);
				const width = widths[index] ?? 150;
				return (
					<div
						key={column.id}
						className="flex items-center px-1"
						style={{ width: `${width}px`, flexShrink: 0 }}
					>
						<FilterCell
							filter={filter}
							value={filter ? values[filter.id] : undefined}
							onValueChange={(value) => {
								if (filter) onChange(nextValues(values, filter.id, value));
							}}
						/>
					</div>
				);
			})}
		</div>
	);
}
