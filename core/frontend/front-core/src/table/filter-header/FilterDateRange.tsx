import type { TableFilterConfig } from "./types";

type FilterDateRangeProps = {
	filter: TableFilterConfig;
	value: string[];
	onValueChange: (value: string[]) => void;
};

export function FilterDateRange({
	filter,
	value,
	onValueChange,
}: FilterDateRangeProps) {
	const [from = "", to = ""] = value;
	return (
		<div className="flex min-w-0 items-center gap-1" title={filter.label}>
			<input
				type="date"
				aria-label={`${filter.label ?? filter.id} from`}
				className="h-7 min-w-0 flex-1 border-0 bg-transparent px-1 text-xs outline-none"
				value={from}
				onInput={(event) => onValueChange([event.currentTarget.value, to])}
			/>
			<input
				type="date"
				aria-label={`${filter.label ?? filter.id} to`}
				className="h-7 min-w-0 flex-1 border-0 bg-transparent px-1 text-xs outline-none"
				value={to}
				onInput={(event) => onValueChange([from, event.currentTarget.value])}
			/>
		</div>
	);
}
