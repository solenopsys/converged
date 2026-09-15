/**
 * Table state, as the flat parameters `rp-equipment` actually reads.
 *
 * The table sends filters as clauses (`filter: {status: {eq: "error"}}`, joined
 * with `AND` once a base selection is involved) and tabs as presets carrying
 * their defaults. `rp-equipment` compiles neither: its listings read
 * `status`, `equipmentId`, `deviceId` straight off the parameters. Without this
 * every filter on the three tables — the "Needs attention" tab included — was
 * sent and ignored. It is the same gap `sf-orders` closes for its status groups.
 *
 * Only the named fields are lifted, and only single values: a field the
 * repository has no column for is not worth pretending to filter by.
 */
export function flatListParams<T>(
	params: Record<string, unknown>,
	fields: readonly string[],
): T {
	const { filter, presets, ...rest } = params as {
		filter?: unknown;
		presets?: { params?: Record<string, unknown> }[];
	} & Record<string, unknown>;
	const allowed = new Set(fields);
	const lifted: Record<string, unknown> = {};

	for (const preset of presets ?? []) {
		for (const [field, value] of Object.entries(preset.params ?? {})) {
			if (allowed.has(field) && isValue(value)) lifted[field] = value;
		}
	}
	// An explicit filter is newer than the tab it was typed under.
	collect(filter, allowed, lifted);

	return { ...rest, ...lifted } as T;
}

const isValue = (value: unknown): value is string | number | boolean =>
	(typeof value === "string" && value !== "") ||
	typeof value === "number" ||
	typeof value === "boolean";

function collect(
	node: unknown,
	allowed: Set<string>,
	into: Record<string, unknown>,
): void {
	if (!node || typeof node !== "object") return;
	for (const [key, clause] of Object.entries(node as Record<string, unknown>)) {
		if (key === "AND" && Array.isArray(clause)) {
			for (const part of clause) collect(part, allowed, into);
			continue;
		}
		if (!allowed.has(key)) continue;
		if (isValue(clause)) {
			into[key] = clause;
			continue;
		}
		if (!clause || typeof clause !== "object") continue;
		const operand = clause as Record<string, unknown>;
		const value =
			operand.eq ??
			operand.contains ??
			(Array.isArray(operand.in) && operand.in.length === 1
				? operand.in[0]
				: undefined);
		if (isValue(value)) into[key] = value;
	}
}
