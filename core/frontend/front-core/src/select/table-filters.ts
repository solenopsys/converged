import type {
	TableFilterConfig,
	TableFilterValues,
} from "../table/filter-header";

type DescriptorField = {
	id: string;
	label: string;
	valueType: string;
	control?: string;
	values?: ReadonlyArray<{ id: unknown; label: string }>;
};

type Descriptor = { fields?: readonly DescriptorField[] } | undefined;

/**
 * The table header a service says it supports. Fields come from the runtime
 * descriptor, never from a list written into the microfrontend, so a table
 * cannot offer a filter the owning service will refuse.
 */
export function selectionHeaderFilters(
	descriptor: Descriptor,
): TableFilterConfig[] {
	return (descriptor?.fields ?? []).map((field): TableFilterConfig => {
		if (field.valueType === "enum" || field.valueType === "boolean") {
			return {
				id: field.id,
				label: field.label,
				type: field.control === "multi-select" ? "multi-select" : "select",
				options:
					field.valueType === "boolean"
						? [
								{ value: "true", label: "Yes" },
								{ value: "false", label: "No" },
							]
						: (field.values ?? []).map((value) => ({
								value: String(value.id),
								label: value.label,
							})),
			};
		}
		return {
			id: field.id,
			label: field.label,
			type: "search",
			placeholder: field.label,
		};
	});
}

/**
 * Turns what the header holds into the canonical predicate. A multi-select
 * becomes `in`, a plain box becomes `contains`, and anything the view was
 * opened on stays anded onto the result — the reference decides the set, the
 * header only narrows it.
 */
export function selectionFilterParams(
	values: TableFilterValues,
	base: TableFilterValues | undefined,
	descriptor?: Descriptor,
): TableFilterValues {
	const fields = new Map(
		(descriptor?.fields ?? []).map((field) => [field.id, field]),
	);
	const clauses: Record<string, unknown> = {};
	for (const [field, value] of Object.entries(values)) {
		if (value === undefined || value === null || value === "") continue;
		if (Array.isArray(value)) {
			if (value.length === 0) continue;
			clauses[field] = { in: value };
			continue;
		}
		if (value === "true" || value === "false") {
			clauses[field] = { eq: value === "true" };
			continue;
		}
		clauses[field] =
			fields.get(field)?.valueType === "string" ? { contains: value } : { eq: value };
	}
	const baseFilter = base?.filter as Record<string, unknown> | undefined;
	const hasClauses = Object.keys(clauses).length > 0;
	const filter =
		baseFilter && hasClauses
			? { AND: [baseFilter, clauses] }
			: hasClauses
				? clauses
				: baseFilter;
	return {
		...(filter ? { filter } : {}),
		...(Array.isArray(base?.presets) && base.presets.length > 0
			? { presets: base.presets }
			: {}),
	};
}
