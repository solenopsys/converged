import type { TableFilterConfig } from "./types";
import { ZagSelectFilter } from "./ZagSelectFilter";

type FilterMultiSelectProps = {
	filter: TableFilterConfig;
	value?: unknown;
	onValueChange: (value: string[]) => void;
};

export function FilterMultiSelect({
	filter,
	value,
	onValueChange,
}: FilterMultiSelectProps) {
	return (
		<ZagSelectFilter
			filter={filter}
			value={Array.isArray(value) ? value.map(String) : []}
			multiple
			onValueChange={onValueChange}
		/>
	);
}
