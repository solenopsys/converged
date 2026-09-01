import { parseFilter } from "./filter";
import type {
	CustomFilterAdapter,
	FilterInput,
	FilterNode,
	FilterSchema,
} from "./types";

/**
 * Bridges the neutral filter AST to a service-owned query representation.
 * The compiler never receives raw filter JSON, which keeps custom stores at
 * the same validation boundary as JSON and Kysely adapters.
 */
export function createCustomFilterAdapter<T>(
	schema: FilterSchema,
	compiler: (filter: FilterNode | undefined) => T,
): CustomFilterAdapter<T> {
	const parse = (input?: FilterInput) => parseFilter(input, schema);
	return {
		parse,
		compile: (input?: FilterInput) => compiler(parse(input)),
	};
}
