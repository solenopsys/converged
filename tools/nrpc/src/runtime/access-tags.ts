import type { AccessMode, GrantTree } from "./access-control";
import { toPermissionEntries } from "./access-control";
import { getCurrentWorkspaceContext } from "./workspace-context-registry";

/**
 * Access tags ride the permission tree under their own kind, so granting one is
 * `addPermissionToUser(user, { kind: "tg", service: "team-support", ... })` and
 * nothing about the token format or the transport changes.
 */
export const ACCESS_TAG_KIND = "tg";

/**
 * The tag every actor carries for themselves. It is derived from the subject of
 * the verified token, never stored and never issued: an object opened to one
 * person is tagged with that person's own tag, which costs nothing in the token
 * and takes effect the moment the row is written.
 */
export const PERSONAL_TAG_PREFIX = "u-";

export function personalTag(userId: string): string {
	return `${PERSONAL_TAG_PREFIX}${userId}`;
}

/**
 * Group tags held by a permission tree, in the order the tree lists them.
 *
 * `mode` narrows to grants that carry it, so a tag held as `r` does not answer a
 * question asked about `w`.
 */
export function tagsFromGrantTree(
	tree: GrantTree | undefined,
	mode?: AccessMode,
): string[] {
	if (!tree) return [];
	const wanted = mode?.trim().toLowerCase();
	const tags: string[] = [];
	const seen = new Set<string>();

	for (const entry of toPermissionEntries(tree)) {
		if (entry.kind !== ACCESS_TAG_KIND) continue;
		const tag = entry.service.trim();
		if (!tag || seen.has(tag)) continue;
		if (wanted && ![...wanted].every((letter) => entry.mode.includes(letter))) {
			continue;
		}
		seen.add(tag);
		tags.push(tag);
	}
	return tags;
}

/**
 * Every tag the current actor may be matched by: their own, then their groups.
 *
 * This is the list that goes into the `IN (...)` of an access-filtered query.
 * An anonymous caller gets an empty list, which selects nothing but `public`.
 */
/**
 * Whether the current caller is a service rather than a person.
 *
 * Services are trusted to act for others: a workflow that files a document on a
 * user's behalf names that user as the owner, and is believed. A person naming
 * an owner is naming somebody to impersonate, and is not.
 */
export function isServiceActor(): boolean {
	return getCurrentWorkspaceContext()?.actorType === "service";
}

export function getCurrentAccessTags(): string[] {
	const context = getCurrentWorkspaceContext();
	const user = context?.user?.trim();
	const groups = context?.accessTags ?? [];
	const tags = user ? [personalTag(user)] : [];

	for (const tag of groups) {
		const normalized = tag.trim();
		if (normalized && !tags.includes(normalized)) tags.push(normalized);
	}
	return tags;
}
