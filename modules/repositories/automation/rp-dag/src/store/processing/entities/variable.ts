import { PrefixedRepositoryKV, SimpleKey } from "back-core";

export const VARIABLE_PREFIX = "persistent";

/** Workflow state written by `rt.set`. Kept under its historical prefix so an
 *  existing store keeps its variables across this refactor. */
export class VariableKey extends SimpleKey {
	readonly prefix = VARIABLE_PREFIX;
}

export class VariableRepository extends PrefixedRepositoryKV<
	VariableKey,
	unknown
> {
	getPrefix(): string[] {
		return [VARIABLE_PREFIX];
	}
}
