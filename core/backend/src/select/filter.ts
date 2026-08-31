import { badRequestError } from "../utils";
import type {
	FilterCondition,
	FilterFieldDefinition,
	FilterGroup,
	FilterInput,
	FilterNode,
	FilterOperator,
	FilterScalar,
	FilterSchema,
	FilterValue,
} from "./types";

const MAX_DEPTH = 5;
const MAX_CONDITIONS = 50;
const MAX_LIST_VALUES = 100;
const LOGICAL_KEYS = new Set(["AND", "OR", "NOT"]);
const VALUELESS_OPERATORS = new Set<FilterOperator>(["isNull", "isNotNull"]);
const LIST_OPERATORS = new Set<FilterOperator>(["in", "notIn"]);

export type FilterOptions = {
	maxDepth?: number;
	maxConditions?: number;
	maxListValues?: number;
};

function invalid(message: string): never {
	throw badRequestError(`Invalid filter: ${message}`);
}

function object(value: unknown, path: string): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		invalid(`${path} must be an object`);
	}
	return value as Record<string, unknown>;
}

function scalar(value: unknown, path: string): FilterScalar {
	if (
		value === null ||
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean"
	) {
		return value as FilterScalar;
	}
	invalid(`${path} must be a scalar`);
}

function validateScalar(
	value: FilterScalar,
	definition: FilterFieldDefinition,
	path: string,
): void {
	if (value === null) return;
	if (definition.valueType === "string" || definition.valueType === "date") {
		if (typeof value !== "string") invalid(`${path} must be a string`);
	} else if (definition.valueType === "number") {
		if (typeof value !== "number" || !Number.isFinite(value)) {
			invalid(`${path} must be a finite number`);
		}
	} else if (typeof value !== "boolean") {
		invalid(`${path} must be a boolean`);
	}
	if (definition.values && !definition.values.includes(value)) {
		invalid(`${path} contains an unsupported value`);
	}
}

function validateValue(
	value: unknown,
	operator: FilterOperator,
	definition: FilterFieldDefinition,
	path: string,
	maxListValues: number,
): FilterValue | undefined {
	if (VALUELESS_OPERATORS.has(operator)) {
		if (value !== undefined && value !== true) {
			invalid(`${path} must be true when present`);
		}
		return undefined;
	}
	if (value === undefined) invalid(`${path} requires a value`);
	if (LIST_OPERATORS.has(operator)) {
		if (!Array.isArray(value) || value.length === 0) {
			invalid(`${path} must be a non-empty array`);
		}
		if (value.length > maxListValues) {
			invalid(`${path} has more than ${maxListValues} values`);
		}
		const result = value.map((item, index) =>
			scalar(item, `${path}[${index}]`),
		);
		for (const item of result) validateScalar(item, definition, path);
		return result;
	}
	if (operator === "between") {
		if (!Array.isArray(value) || value.length !== 2) {
			invalid(`${path} must contain exactly two values`);
		}
		const result = [
			scalar(value[0], `${path}[0]`),
			scalar(value[1], `${path}[1]`),
		] as [FilterScalar, FilterScalar];
		for (const item of result) validateScalar(item, definition, path);
		return result;
	}
	const result = scalar(value, path);
	validateScalar(result, definition, path);
	return result;
}

function parseField(
	field: string,
	value: unknown,
	schema: FilterSchema,
	path: string,
	maxListValues: number,
): FilterNode[] {
	const definition = schema[field];
	if (!definition) invalid(`${path} uses unknown field "${field}"`);
	const operators = object(value, path);
	const conditions: FilterCondition[] = [];
	for (const [operator, operatorValue] of Object.entries(operators)) {
		if (!definition.operators.includes(operator as FilterOperator)) {
			invalid(`${path}.${operator} is not supported`);
		}
		const parsedValue = validateValue(
			operatorValue,
			operator as FilterOperator,
			definition,
			`${path}.${operator}`,
			maxListValues,
		);
		conditions.push({
			kind: "condition",
			field,
			operator: operator as FilterOperator,
			...(parsedValue === undefined ? {} : { value: parsedValue }),
		});
	}
	if (conditions.length === 0) invalid(`${path} must specify an operator`);
	return conditions;
}

function parseNode(
	input: FilterInput,
	schema: FilterSchema,
	depth: number,
	state: { conditions: number },
	options: Required<FilterOptions>,
): FilterNode | undefined {
	if (depth > options.maxDepth) invalid(`nesting exceeds ${options.maxDepth}`);
	const nodes: FilterNode[] = [];
	for (const [key, value] of Object.entries(input)) {
		if (key === "AND" || key === "OR") {
			if (!Array.isArray(value) || value.length === 0) {
				invalid(`${key} must be a non-empty array`);
			}
			const items = value
				.map((item, index) =>
					parseNode(
						object(item, `${key}[${index}]`),
						schema,
						depth + 1,
						state,
						options,
					),
				)
				.filter((item): item is FilterNode => Boolean(item));
			nodes.push({
				kind: "group",
				operator: key === "AND" ? "and" : "or",
				items,
			});
			continue;
		}
		if (key === "NOT") {
			const item = parseNode(
				object(value, "NOT"),
				schema,
				depth + 1,
				state,
				options,
			);
			if (item) nodes.push({ kind: "group", operator: "not", items: [item] });
			continue;
		}
		if (LOGICAL_KEYS.has(key)) continue;
		const fieldNodes = parseField(
			key,
			value,
			schema,
			key,
			options.maxListValues,
		);
		state.conditions += fieldNodes.length;
		if (state.conditions > options.maxConditions) {
			invalid(`contains more than ${options.maxConditions} conditions`);
		}
		nodes.push(...fieldNodes);
	}
	if (nodes.length === 0) return undefined;
	return nodes.length === 1
		? nodes[0]
		: { kind: "group", operator: "and", items: nodes };
}

export function parseFilter(
	input: FilterInput | undefined,
	schema: FilterSchema,
	options: FilterOptions = {},
): FilterNode | undefined {
	if (input === undefined) return undefined;
	return normalizeFilter(
		parseNode(
			input,
			schema,
			1,
			{ conditions: 0 },
			{
				maxDepth: options.maxDepth ?? MAX_DEPTH,
				maxConditions: options.maxConditions ?? MAX_CONDITIONS,
				maxListValues: options.maxListValues ?? MAX_LIST_VALUES,
			},
		),
	);
}

export function normalizeFilter(
	filter: FilterNode | undefined,
): FilterNode | undefined {
	if (!filter || filter.kind === "condition") return filter;
	const items = filter.items
		.map(normalizeFilter)
		.filter((item): item is FilterNode => Boolean(item))
		.flatMap((item) =>
			item.kind === "group" &&
			item.operator === filter.operator &&
			item.operator !== "not"
				? item.items
				: [item],
		);
	if (items.length === 0) return undefined;
	if (filter.operator !== "not" && items.length === 1) return items[0];
	return { ...filter, items } as FilterGroup;
}

export function combineFilters(
	left: FilterNode | undefined,
	right: FilterNode | undefined,
	operator: "and" | "or" = "and",
): FilterNode | undefined {
	if (!left) return right;
	if (!right) return left;
	return normalizeFilter({ kind: "group", operator, items: [left, right] });
}
