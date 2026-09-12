import type { KVStore } from "../engines/kv/kv-store";
import { KEY_SEPARATOR } from "../utils";
import { AccessDeniedError } from "./service";
import {
	AUTHENTICATED_TAG,
	actorTags,
	identityTags,
	PUBLIC_TAG,
	personalTag,
	tagsForNew,
	type Visibility,
} from "./tags";

/** `tag:<tag>:<objectId>` — the direct index, walked to enumerate a tag. */
export const TAG_INDEX_PREFIX = "tag";

/** `obj:<objectId>:<tag>` — the reverse, read to check or change one object. */
export const OBJECT_INDEX_PREFIX = "obj";

/**
 * Access tags of a key-value store: the same scheme as the SQL relation, held
 * as keys.
 *
 * Both directions are written, because both are asked for. Listing what a tag
 * opens is a prefix scan of `tag:<tag>:`, which is the selection path and the
 * reason the direct index exists at all; deciding one object is a scan of
 * `obj:<objectId>:`, which is what a read handler does. Neither stores a value
 * — the key is the fact.
 *
 * The calls are synchronous like the rest of the KV engine: it answers from the
 * storage process without a round trip per entry, and making these async would
 * only spread promises through callers that have none.
 *
 * One limit worth knowing: `kvList` returns a whole range, with no cursor. A
 * listing is therefore honest only while a single tag's range fits in memory,
 * which is the constraint `access-control.md` records for KV stores generally,
 * not something this class can decide on its own.
 */
export class KvAccessTags {
	constructor(private readonly store: KVStore) {}

	/** Opens `objectId` to `tag`. Repeating a grant is not an error. */
	grant(objectId: string, tag: string): void {
		const object = assertSegment(objectId, "objectId");
		const normalized = assertSegment(tag, "tag");
		this.store.put([TAG_INDEX_PREFIX, normalized, object], 1);
		this.store.put([OBJECT_INDEX_PREFIX, object, normalized], 1);
	}

	grantMany(objectId: string, tags: readonly string[]): void {
		for (const tag of tags) {
			if (tag.trim()) this.grant(objectId, tag);
		}
	}

	revoke(objectId: string, tag: string): void {
		const object = objectId.trim();
		const normalized = tag.trim();
		this.store.delete([TAG_INDEX_PREFIX, normalized, object]);
		this.store.delete([OBJECT_INDEX_PREFIX, object, normalized]);
	}

	/** Tags a newly created object, from the current actor and the visibility. */
	tagNew(
		objectId: string,
		options: {
			visibility?: Visibility;
			owner?: string;
			tags?: readonly string[];
		} = {},
	): string[] {
		const tags = tagsForNew(options);
		this.grantMany(objectId, tags);
		return tags;
	}

	/** Replaces the object's whole tag set. */
	setTags(objectId: string, tags: readonly string[]): void {
		this.dropObject(objectId);
		this.grantMany(objectId, tags);
	}

	/** Re-points the object at the visibility it now declares, leaving the rest. */
	setVisibility(objectId: string, visibility: Visibility): void {
		this.revoke(objectId, PUBLIC_TAG);
		this.revoke(objectId, AUTHENTICATED_TAG);
		if (visibility === "public") this.grant(objectId, PUBLIC_TAG);
		if (visibility === "authenticated") this.grant(objectId, AUTHENTICATED_TAG);
	}

	/**
	 * Removes every tag of an object. Must be called when the object is deleted
	 * — including when a log prunes itself — or a leftover key would later match
	 * a reused id.
	 */
	dropObject(objectId: string): void {
		for (const tag of this.tagsOf(objectId)) this.revoke(objectId, tag);
	}

	tagsOf(objectId: string): string[] {
		return this.segmentsUnder(OBJECT_INDEX_PREFIX, objectId.trim());
	}

	/** Every object a tag opens. */
	objectsOf(tag: string): string[] {
		return this.segmentsUnder(TAG_INDEX_PREFIX, tag.trim());
	}

	/**
	 * The last segment of every key directly under `prefix:middle:`.
	 *
	 * `listKeys` drops the trailing separator before it scans, so a range asked
	 * for `tag:team` comes back holding `tag:team-ops:...` as well — one tag's
	 * range spilling into another's, and a tag named as a prefix of another
	 * quietly granting it. The separator is put back here, where the answer is
	 * read, rather than trusted to the scan.
	 */
	private segmentsUnder(prefix: string, middle: string): string[] {
		if (!middle) return [];
		const exact = `${prefix}${KEY_SEPARATOR}${middle}${KEY_SEPARATOR}`;
		const values: string[] = [];
		for (const key of this.store.listKeys([prefix, middle])) {
			if (!key.startsWith(exact)) continue;
			const segment = key.slice(exact.length);
			if (segment && !segment.includes(KEY_SEPARATOR)) values.push(segment);
		}
		return values;
	}

	/**
	 * The ids the given tags open, deduplicated — the set a listing is filtered
	 * through, gathered from the tag side so it costs what the caller may see
	 * rather than what the store holds.
	 */
	visibleIds(tags: readonly string[] = actorTags()): Set<string> {
		const ids = new Set<string>();
		for (const tag of tags) {
			for (const id of this.objectsOf(tag)) ids.add(id);
		}
		return ids;
	}

	/** Whether the current actor is matched by any tag of this object. */
	canRead(objectId: string): boolean {
		return intersects(this.tagsOf(objectId), actorTags());
	}

	requireRead(objectId: string): void {
		if (!this.canRead(objectId)) throw new AccessDeniedError(objectId);
	}

	/** Whether the object is the actor's own, rather than merely open to them. */
	canWrite(objectId: string): boolean {
		return intersects(this.tagsOf(objectId), identityTags());
	}

	requireWrite(objectId: string): void {
		if (!this.canWrite(objectId)) throw new AccessDeniedError(objectId);
	}

	grantToUser(objectId: string, userId: string): void {
		this.grant(objectId, personalTag(userId));
	}

	revokeFromUser(objectId: string, userId: string): void {
		this.revoke(objectId, personalTag(userId));
	}
}

/**
 * A key segment that cannot break the key.
 *
 * `:` separates segments and `;` ends a range, so either inside an id or a tag
 * makes the key ambiguous and the next scan pick up somebody else's object —
 * the rule `access-control.md` states for ids, enforced here for both.
 */
function assertSegment(value: string, what: string): string {
	const normalized = value?.trim() ?? "";
	if (!normalized) throw new Error(`${what} is required`);
	if (normalized.includes(KEY_SEPARATOR) || normalized.includes(";")) {
		throw new Error(`${what} must not contain ':' or ';': ${normalized}`);
	}
	return normalized;
}

function intersects(
	left: readonly string[],
	right: readonly string[],
): boolean {
	if (left.length === 0 || right.length === 0) return false;
	const set = new Set(right);
	return left.some((value) => set.has(value));
}
