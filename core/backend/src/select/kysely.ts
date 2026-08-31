import type { ExpressionBuilder, SqlBool } from "kysely";
import { parseFilter } from "./filter";
import type {
	FilterCondition,
	FilterFieldDefinition,
	FilterInput,
	FilterNode,
	FilterSchema,
} from "./types";

export type KyselyFilterField = FilterFieldDefinition & {
	column?: string;
	compile?: (
		expression: ExpressionBuilder<any, any>,
		condition: FilterCondition,
	) => any;
};

export type KyselyFilterSchema = Record<string, KyselyFilterField>;

function defaultCondition(
	expression: ExpressionBuilder<any, any>,
	field: KyselyFilterField,
	condition: FilterCondition,
): any {
	if (!field.column) {
		throw new Error(
			`Kysely filter field "${condition.field}" has no column or compiler`,
		);
	}
	const column = field.column as any;
	switch (condition.operator) {
		case "eq":
			return expression(column, "=", condition.value as any);
		case "notEq":
			return expression(column, "!=", condition.value as any);
		case "in":
			return expression(column, "in", condition.value as any);
		case "notIn":
			return expression(column, "not in", condition.value as any);
		case "contains":
			return expression(column, "like", `%${String(condition.value)}%`);
		case "startsWith":
			return expression(column, "like", `${String(condition.value)}%`);
		case "gt":
			return expression(column, ">", condition.value as any);
		case "gte":
			return expression(column, ">=", condition.value as any);
		case "lt":
			return expression(column, "<", condition.value as any);
		case "lte":
			return expression(column, "<=", condition.value as any);
		case "between": {
			const value = condition.value as [unknown, unknown];
			return expression.and([
				expression(column, ">=", value[0] as any),
				expression(column, "<=", value[1] as any),
			]);
		}
		case "isNull":
			return expression(column, "is", null);
		case "isNotNull":
			return expression(column, "is not", null);
	}
}

function compileNode(
	expression: ExpressionBuilder<any, any>,
	filter: FilterNode,
	schema: KyselyFilterSchema,
): any {
	if (filter.kind === "condition") {
		const field = schema[filter.field];
		if (!field)
			throw new Error(`Unknown Kysely filter field "${filter.field}"`);
		return field.compile
			? field.compile(expression, filter)
			: defaultCondition(expression, field, filter);
	}
	const items = filter.items.map((item) =>
		compileNode(expression, item, schema),
	);
	if (filter.operator === "and") return expression.and(items);
	if (filter.operator === "or") return expression.or(items);
	return expression.not(items[0]);
}

export function applyKyselyFilter<
	T extends { where: (callback: any) => unknown },
>(query: T, input: FilterInput | undefined, schema: KyselyFilterSchema): T {
	const validationSchema: FilterSchema = Object.fromEntries(
		Object.entries(schema).map(([id, field]) => [
			id,
			{
				valueType: field.valueType,
				operators: field.operators,
				values: field.values,
			},
		]),
	);
	const filter = parseFilter(input, validationSchema);
	if (!filter) return query;
	return query.where(
		(expression: ExpressionBuilder<any, any>) =>
			compileNode(expression, filter, schema) as SqlBool,
	) as T;
}
