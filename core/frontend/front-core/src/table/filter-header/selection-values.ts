import type { TableFilterConfig, TableFilterValues } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Shows simple predicates from an opened SetRef in the matching header cells.
 * Complex logical expressions remain executable on the server but are not
 * flattened into controls, because that would silently change their meaning.
 */
export function valuesFromSelectionFilter(
	filters: readonly TableFilterConfig[] | undefined,
	baseFilters: TableFilterValues | undefined,
): TableFilterValues {
	if (!filters || !isRecord(baseFilters?.filter)) return {};
	const values: TableFilterValues = {};
	for (const filter of filters) {
		const condition = baseFilters.filter[filter.id];
		if (!isRecord(condition)) continue;
		if ("eq" in condition) {
			const value = condition.eq;
			values[filter.id] =
				filter.type === "multi-select" ? [String(value)] : String(value);
			continue;
		}
		if (Array.isArray(condition.in)) {
			values[filter.id] = condition.in.map(String);
			continue;
		}
		if (filter.type === "date-range" && Array.isArray(condition.between)) {
			values[filter.id] = condition.between.map(String);
		}
	}
	return values;
}
