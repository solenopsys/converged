import type { TableFilterConfig } from "./types";
import { ZagSelectFilter } from "./ZagSelectFilter";

type FilterSelectProps = {
	filter: TableFilterConfig;
	value?: unknown;
	onValueChange: (value: string) => void;
};

export function FilterSelect({
	filter,
	value,
	onValueChange,
}: FilterSelectProps) {
	return (
		<ZagSelectFilter
			filter={filter}
			value={typeof value === "string" ? [value] : []}
			onValueChange={(next) => onValueChange(next[0] ?? "")}
		/>
	);
}
