import { getCurrentAccessTags, personalTag } from "nrpc";

export { personalTag };

/** Readable by anyone, including callers with no token at all. */
export const PUBLIC_TAG = "public";

/** Readable by any actor the token verified, whoever they are. */
export const AUTHENTICATED_TAG = "authenticated";

/**
 * Visibility is not a column here — it is which well-known tag an object is
 * written with. That keeps one code path: every selection is a lookup by tag,
 * so it is always driven by the tag index instead of an `OR` the planner has to
 * unpick.
 */
export type Visibility = "public" | "authenticated" | "private" | "tagged";

/**
 * Every tag the current actor may be matched by, in the order a query should
 * receive them: the open ones first, then the actor's own, then their groups.
 *
 * An anonymous caller gets `["public"]` — which selects public objects and
 * nothing else, rather than failing closed on an empty list and hiding content
 * that was meant to be open.
 */
export function actorTags(): string[] {
	const identity = getCurrentAccessTags();
	if (identity.length === 0) return [PUBLIC_TAG];
	return [PUBLIC_TAG, AUTHENTICATED_TAG, ...identity];
}

/**
 * The tags a new object is created with.
 *
 * `owner` comes from the verified token at the call site, never from the client
 * payload — an object whose owner tag is chosen by the caller is an object
 * anyone can claim.
 */
export function tagsForNew(options: {
	visibility?: Visibility;
	owner?: string;
	tags?: readonly string[];
}): string[] {
	const { visibility = "private", owner, tags = [] } = options;
	const result = new Set<string>();

	if (owner?.trim()) result.add(personalTag(owner.trim()));
	if (visibility === "public") result.add(PUBLIC_TAG);
	if (visibility === "authenticated") result.add(AUTHENTICATED_TAG);
	for (const tag of tags) {
		const normalized = tag.trim();
		if (normalized) result.add(normalized);
	}
	return [...result];
}
