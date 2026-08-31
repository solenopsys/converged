import { parseFilter } from "./filter";
import type {
	FilterCondition,
	FilterInput,
	FilterNode,
	FilterScalar,
	FilterSchema,
	JsonFilterAdapter,
} from "./types";

function compare(left: FilterScalar, right: FilterScalar): number {
	if (left === right) return 0;
	if (left === null) return -1;
	if (right === null) return 1;
	return left < right ? -1 : 1;
}

function conditionMatches(
	item: Record<string, unknown>,
	condition: FilterCondition,
): boolean {
	const current = item[condition.field] as
		| FilterScalar
		| FilterScalar[]
		| undefined;
	const value = condition.value;
	switch (condition.operator) {
		case "isNull":
			return current === null || current === undefined;
		case "isNotNull":
			return current !== null && current !== undefined;
		case "eq":
			return current === value;
		case "notEq":
			return current !== value;
		case "in":
			return Array.isArray(value) && value.includes(current as FilterScalar);
		case "notIn":
			return Array.isArray(value) && !value.includes(current as FilterScalar);
		case "contains":
			return typeof current === "string" && typeof value === "string"
				? current.includes(value)
				: Array.isArray(current) && current.includes(value as FilterScalar);
		case "startsWith":
			return (
				typeof current === "string" &&
				typeof value === "string" &&
				current.startsWith(value)
			);
		case "gt":
			return compare(current as FilterScalar, value as FilterScalar) > 0;
		case "gte":
			return compare(current as FilterScalar, value as FilterScalar) >= 0;
		case "lt":
			return compare(current as FilterScalar, value as FilterScalar) < 0;
		case "lte":
			return compare(current as FilterScalar, value as FilterScalar) <= 0;
		case "between":
			return (
				Array.isArray(value) &&
				compare(current as FilterScalar, value[0]) >= 0 &&
				compare(current as FilterScalar, value[1]) <= 0
			);
	}
}

function matches(
	item: Record<string, unknown>,
	filter: FilterNode | undefined,
): boolean {
	if (!filter) return true;
	if (filter.kind === "condition") return conditionMatches(item, filter);
	if (filter.operator === "and")
		return filter.items.every((child) => matches(item, child));
	if (filter.operator === "or")
		return filter.items.some((child) => matches(item, child));
	return !filter.items.some((child) => matches(item, child));
}

export function createJsonFilterAdapter<T extends Record<string, unknown>>(
	schema: FilterSchema,
): JsonFilterAdapter<T> {
	return {
		parse: (input?: FilterInput) => parseFilter(input, schema),
		predicate: (input?: FilterInput) => {
			const filter = parseFilter(input, schema);
			return (item) => matches(item, filter);
		},
	};
}
