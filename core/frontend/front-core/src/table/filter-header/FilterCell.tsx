import { FilterMultiSelect } from "./FilterMultiSelect";
import { FilterSelect } from "./FilterSelect";
import { FilterTextInput } from "./FilterTextInput";
import type { TableFilterConfig } from "./types";

type FilterCellProps = {
	filter?: TableFilterConfig;
	value?: unknown;
	onValueChange: (value: string | string[]) => void;
};

export function FilterCell({ filter, value, onValueChange }: FilterCellProps) {
	if (!filter) return null;
	if (filter.type === "search") {
		return (
			<FilterTextInput
				filter={filter}
				value={typeof value === "string" ? value : ""}
				onValueChange={onValueChange}
			/>
		);
	}
	if (filter.type === "multi-select") {
		return (
			<FilterMultiSelect
				filter={filter}
				value={value}
				onValueChange={onValueChange}
			/>
		);
	}
	return (
		<FilterSelect filter={filter} value={value} onValueChange={onValueChange} />
	);
}
