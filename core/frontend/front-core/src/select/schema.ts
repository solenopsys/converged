import type { FilterOperator } from "back-core";
import type { SelectionDefinition, SelectionFilterDefinition } from "./types";

function valueSchema(
	filter: SelectionFilterDefinition,
): Record<string, unknown> {
	if (filter.options?.length) {
		return {
			enum: filter.options.map((option) => option.id),
			description: `Allowed values (use ID, not label): ${filter.options
				.map(
					(option) =>
						`${option.label} = ${JSON.stringify(option.id)}${
							option.aliases?.length
								? ` (aliases: ${option.aliases.join(", ")})`
								: ""
						}`,
				)
				.join("; ")}`,
		};
	}
	return {
		type:
			filter.valueType === "number"
				? "number"
				: filter.valueType === "boolean"
					? "boolean"
					: "string",
	};
}

function operatorSchema(
	filter: SelectionFilterDefinition,
	operator: FilterOperator,
): Record<string, unknown> {
	if (operator === "isNull" || operator === "isNotNull")
		return { type: "boolean" };
	const value = valueSchema(filter);
	if (operator === "in" || operator === "notIn")
		return { type: "array", minItems: 1, items: value };
	if (operator === "between")
		return { type: "array", minItems: 2, maxItems: 2, items: value };
	return value;
}

export function selectionFilterSchema(
	definition: SelectionDefinition,
): Record<string, unknown> {
	return {
		type: "object",
		description:
			"Fields at one level are combined with AND. AND, OR and NOT create nested logical expressions.",
		properties: {
			...Object.fromEntries(
				definition.filters.map((filter) => [
					filter.id,
					{
						type: "object",
						description: filter.description ?? filter.label,
						properties: Object.fromEntries(
							filter.operators.map((operator) => [
								operator,
								operatorSchema(filter, operator),
							]),
						),
						additionalProperties: false,
					},
				]),
			),
			AND: { type: "array", items: { type: "object" } },
			OR: { type: "array", items: { type: "object" } },
			NOT: { type: "object" },
		},
		additionalProperties: false,
	};
}

export function selectCommandSchema(
	definition: SelectionDefinition,
): Record<string, unknown> {
	return {
		type: "object",
		properties: {
			scope: {
				type: "string",
				enum: ["new", "current"],
				default: "new",
				description: "new opens a new set; current updates the active set",
			},
			mode: {
				type: "string",
				enum: ["replace", "refine"],
				default: "replace",
				description: "replace replaces a filter; refine adds it with AND",
			},
			filter: selectionFilterSchema(definition),
			...(definition.presets?.length
				? {
						presets: {
							type: "array",
							items: {
								oneOf: definition.presets.map((preset) => ({
									type: "object",
									description: `${preset.id}: ${preset.description ?? preset.label}`,
									properties: {
										id: { type: "string", enum: [preset.id] },
										...(preset.parameters
											? { params: preset.parameters }
											: {}),
									},
									required: ["id"],
									additionalProperties: false,
								})),
							},
						},
					}
				: {}),
		},
		required: ["scope", "mode"],
		additionalProperties: false,
	};
}
