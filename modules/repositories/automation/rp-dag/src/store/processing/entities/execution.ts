import { type KeyKV, PrefixedRepositoryKV, PrefixKey } from "back-core";
import type { Execution } from "g-dag";

export const EXECUTION_PREFIX = "exec";

export class ExecutionKey extends PrefixKey implements KeyKV {
	readonly prefix = EXECUTION_PREFIX;

	constructor(private executionId: string) {
		super();
	}

	build(): string[] {
		return [this.prefix, this.executionId];
	}
}

export class ExecutionRepository extends PrefixedRepositoryKV<
	ExecutionKey,
	Execution
> {
	getPrefix(): string[] {
		return [EXECUTION_PREFIX];
	}
}
