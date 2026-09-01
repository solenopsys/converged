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

/**
 * A named predicate owned and compiled by a microservice. Unlike FilterInput,
 * its implementation is intentionally opaque to clients: it may be a SQL
 * subquery, a search query or any other storage-native condition.
 */
export type SelectionPreset = {
	id: string;
	params?: Record<string, unknown>;
};

/** Runtime description of a selectable object's server-owned query language. */
export type SelectionValueDescriptor = {
	id: FilterScalar;
	label: string;
	aliases?: string[];
};

export type SelectionFieldDescriptor = {
	id: string;
	label: string;
	description?: string;
	valueType: FilterValueType | "enum";
	operators: string[];
	control?: "text" | "select" | "multi-select" | "boolean" | "date-range";
	values?: SelectionValueDescriptor[];
};

/** An opaque, server-compiled predicate advertised to UI and LLM. */
export type SelectionPresetDescriptor = {
	id: string;
	label: string;
	description?: string;
	control?: "tab" | "button" | "menu";
	group?: string;
	parameters?: Record<string, unknown>;
	defaults?: Record<string, unknown>;
};

export type SelectionDescriptor = {
	objectType: string;
	title: string;
	description?: string;
	fields: SelectionFieldDescriptor[];
	presets?: SelectionPresetDescriptor[];
	filterExample?: FilterInput;
	revision?: string;
};

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

/**
 * Adapter for a storage engine or remote API that owns its own query format.
 * It still receives the validated, normalized filter AST rather than raw
 * client JSON, so every implementation gets the same safety boundary.
 */
export type CustomFilterAdapter<T> = {
	parse(input?: FilterInput): FilterNode | undefined;
	compile(input?: FilterInput): T;
};
