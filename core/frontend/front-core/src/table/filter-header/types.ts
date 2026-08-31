export type TableFilterOption = {
	value: string;
	label: string;
};

export type TableFilterConfig = {
	id: string;
	type: "search" | "select" | "multi-select";
	label?: string;
	placeholder?: string;
	options?: readonly TableFilterOption[];
	allLabel?: string;
	debounceMs?: number;
};

export type TableFilterValues = Record<string, unknown>;
