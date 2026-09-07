import { type KeyKV, PrefixedRepositoryKV, PrefixKey } from "back-core";
import type { ExecutionNode } from "g-dag";

export const NODE_PREFIX = "node";

/**
 * Width of the zero-padded sequence in a node key. The runtime pads to the same
 * width when it composes the cache key, and the two must agree: a committed
 * entry lands under the key this class would have produced.
 */
export const SEQ_WIDTH = 6;

export function seqSegment(seq: number): string {
	return String(seq).padStart(SEQ_WIDTH, "0");
}

/**
 * `node:<executionId>:<seq>`.
 *
 * The sequence is zero-padded because the KV store returns a prefix range in
 * lexicographic order: padding is what makes that order the order the nodes
 * opened in, so reading a run's tree needs no sort.
 */
export class NodeKey extends PrefixKey implements KeyKV {
	readonly prefix = NODE_PREFIX;

	constructor(
		private executionId: string,
		private seq: number,
	) {
		super();
	}

	build(): string[] {
		return [this.prefix, this.executionId, seqSegment(this.seq)];
	}
}

export class NodeRepository extends PrefixedRepositoryKV<
	NodeKey,
	ExecutionNode
> {
	getPrefix(): string[] {
		return [NODE_PREFIX];
	}
}
