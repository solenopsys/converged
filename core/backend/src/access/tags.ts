import {
	getCurrentAccessTags,
	getCurrentWorkspaceContext,
	personalTag,
} from "nrpc";

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
 * Only the tags that belong to the actor personally — their own and their
 * groups — with the open ones left out.
 *
 * This is the list a *write* is judged by. Reading answers "is this object open
 * to me", and `public` is a legitimate yes; editing answers "is this object
 * mine", and there `public` would mean everyone owns it.
 */
export function identityTags(): string[] {
	return getCurrentAccessTags();
}

/**
 * The tags a new object is created with.
 *
 * `owner` defaults to the acting subject, because the alternative is worse than
 * a wrong owner: a `private` object created without one carries no tags at all,
 * which makes it unreadable by everybody including the person who just made it,
 * and nothing about that failure is visible until somebody goes looking for the
 * row. Passing `owner` explicitly is for the case where a trusted service files
 * something on another person's behalf.
 *
 * What it never comes from is the client payload — an object whose owner tag is
 * chosen by the caller is an object anyone can claim.
 */
export function tagsForNew(options: {
	visibility?: Visibility;
	owner?: string;
	tags?: readonly string[];
}): string[] {
	const { visibility = "private", tags = [] } = options;
	const owner = options.owner ?? getCurrentWorkspaceContext()?.user;
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
