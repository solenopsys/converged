export type FilterScalar = string | number | boolean | null;

export type FilterValue =
	| FilterScalar
	| FilterScalar[]
	| [FilterScalar, FilterScalar];

export type FilterOperator =
	| "eq"
	| "notEq"
	| "in"
	| "notIn"
	| "contains"
	| "startsWith"
	| "gt"
	| "gte"
	| "lt"
	| "lte"
	| "between"
	| "isNull"
	| "isNotNull";

export type FilterValueType = "string" | "number" | "boolean" | "date";

export type FilterFieldDefinition = {
	valueType: FilterValueType;
	operators: readonly FilterOperator[];
	values?: readonly FilterScalar[];
};

export type FilterSchema = Record<string, FilterFieldDefinition>;

export type FilterInput = Record<string, unknown>;

export type FilterCondition = {
	kind: "condition";
	field: string;
	operator: FilterOperator;
	value?: FilterValue;
};

export type FilterGroup = {
	kind: "group";
	operator: "and" | "or" | "not";
	items: FilterNode[];
};

export type FilterNode = FilterCondition | FilterGroup;

export type JsonFilterAdapter<T extends Record<string, unknown>> = {
	parse(input?: FilterInput): FilterNode | undefined;
	predicate(input?: FilterInput): (item: T) => boolean;
};
