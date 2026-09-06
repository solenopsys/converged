export type TableFilterOption = {
	value: string;
	label: string;
};

export type TableFilterConfig = {
	/** Key used in the filter payload. */
	id: string;
	/**
	 * Column that renders this control. Defaults to `id` for scalar fields;
	 * relation filters may use a different payload key.
	 */
	columnId?: string;
	type: "search" | "select" | "multi-select" | "date-range";
	label?: string;
	placeholder?: string;
	options?: readonly TableFilterOption[];
	/** Loads relation-backed options when the filter is mounted. */
	loadOptions?: () => Promise<readonly TableFilterOption[]>;
	allLabel?: string;
	debounceMs?: number;
};

export type TableFilterValues = Record<string, unknown>;
