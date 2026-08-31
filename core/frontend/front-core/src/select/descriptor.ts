import type { FilterOperator } from "back-core";
import type { ObjectTypeDefinition } from "../object-runtime";
import type { SelectionDefinition, SelectionFilterDefinition } from "./types";

type RuntimeDescriptor =
	NonNullable<
		NonNullable<ObjectTypeDefinition["selection"]>["describe"]
	> extends () => Promise<infer Descriptor>
		? Descriptor
		: never;

const descriptors = new Map<string, RuntimeDescriptor>();

function descriptorDefinition(
	descriptor: RuntimeDescriptor,
): SelectionDefinition {
	return {
		filters: descriptor.fields.map(
			(field): SelectionFilterDefinition => ({
				id: field.id,
				label: field.label,
				...(field.description ? { description: field.description } : {}),
				valueType: field.valueType === "enum" ? "string" : field.valueType,
				operators: field.operators as FilterOperator[],
				...(field.values
					? {
							options: field.values.map((value) => ({
								id: value.id,
								label: value.label,
								...(value.aliases ? { aliases: value.aliases } : {}),
							})),
						}
					: {}),
				...(field.control ? { control: field.control } : {}),
			}),
		),
	};
}

export async function loadSelectionDescriptor(
	type: ObjectTypeDefinition,
): Promise<SelectionDefinition | undefined> {
	if (!type.selection) return undefined;
	const cached = descriptors.get(type.id);
	if (cached) return descriptorDefinition(cached);
	if (!type.selection.describe) {
		return { filters: type.selection.filters as SelectionFilterDefinition[] };
	}
	const descriptor = await type.selection.describe();
	descriptors.set(type.id, descriptor);
	return descriptorDefinition(descriptor);
}

export function selectionDefinition(
	type: ObjectTypeDefinition | undefined,
): SelectionDefinition | undefined {
	if (!type?.selection) return undefined;
	const descriptor = descriptors.get(type.id);
	return descriptor
		? descriptorDefinition(descriptor)
		: { filters: type.selection.filters as SelectionFilterDefinition[] };
}

export function selectionDescriptor(
	type: string,
): RuntimeDescriptor | undefined {
	return descriptors.get(type);
}
