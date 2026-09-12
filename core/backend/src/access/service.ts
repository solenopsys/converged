import type { SqlStore } from "../engines/sql/sql-store";
import { ACCESS_TAGS_TABLE } from "./migration";
import {
	AUTHENTICATED_TAG,
	actorTags,
	identityTags,
	PUBLIC_TAG,
	personalTag,
	tagsForNew,
	type Visibility,
} from "./tags";

export class AccessDeniedError extends Error {
	constructor(objectId: string) {
		super(`access denied: ${objectId}`);
		this.name = "AccessDeniedError";
	}
}

/**
 * Access tags of one store: who may see which object, kept next to the objects
 * themselves so a decision never leaves the service that owns the data.
 *
 * Grants and revocations take effect on the next request, because this table is
 * read on every request — unlike group tags, which ride the token and therefore
 * wait for it to be reissued.
 */
export class AccessTags {
	constructor(private readonly store: SqlStore) {}

	private get db() {
		return this.store.db as any;
	}

	/** Opens `objectId` to `tag`. Repeating a grant is not an error. */
	async grant(objectId: string, tag: string): Promise<void> {
		await this.grantMany(objectId, [tag]);
	}

	async grantMany(objectId: string, tags: readonly string[]): Promise<void> {
		const values = normalize(tags).map((tag) => ({ objectId, tag }));
		if (values.length === 0) return;
		await this.db
			.insertInto(ACCESS_TAGS_TABLE)
			.values(values)
			.onConflict((oc: any) => oc.columns(["tag", "objectId"]).doNothing())
			.execute();
	}

	async revoke(objectId: string, tag: string): Promise<void> {
		await this.db
			.deleteFrom(ACCESS_TAGS_TABLE)
			.where("objectId", "=", objectId)
			.where("tag", "=", tag)
			.execute();
	}

	/**
	 * Re-points an object at the visibility it now declares, leaving every other
	 * tag alone.
	 *
	 * Visibility is stored twice on purpose: as a column, because that is what an
	 * editor shows and a contract carries, and as one of the well-known tags,
	 * because that is what a selection can be driven by. This is the one place
	 * that keeps the two in step, so an object narrowed from `public` to
	 * `private` stops being listed on the next request rather than the next
	 * migration.
	 */
	async setVisibility(objectId: string, visibility: Visibility): Promise<void> {
		await this.db
			.deleteFrom(ACCESS_TAGS_TABLE)
			.where("objectId", "=", objectId)
			.where("tag", "in", [PUBLIC_TAG, AUTHENTICATED_TAG])
			.execute();

		if (visibility === "public") await this.grant(objectId, PUBLIC_TAG);
		if (visibility === "authenticated")
			await this.grant(objectId, AUTHENTICATED_TAG);
	}

	/** Replaces the object's whole tag set. Used when access is edited wholesale. */
	async setTags(objectId: string, tags: readonly string[]): Promise<void> {
		await this.dropObject(objectId);
		await this.grantMany(objectId, tags);
	}

	/**
	 * Removes every tag of an object. Must be called when the object is deleted:
	 * a leftover row would later match a reused id.
	 */
	async dropObject(objectId: string): Promise<void> {
		await this.db
			.deleteFrom(ACCESS_TAGS_TABLE)
			.where("objectId", "=", objectId)
			.execute();
	}

	async tagsOf(objectId: string): Promise<string[]> {
		const rows = await this.db
			.selectFrom(ACCESS_TAGS_TABLE)
			.select("tag")
			.where("objectId", "=", objectId)
			.execute();
		return rows.map((row: { tag: string }) => row.tag);
	}

	/** Tags a newly created object, from the current actor and the chosen visibility. */
	async tagNew(
		objectId: string,
		options: {
			visibility?: Visibility;
			owner?: string;
			tags?: readonly string[];
		} = {},
	): Promise<string[]> {
		const tags = tagsForNew(options);
		await this.grantMany(objectId, tags);
		return tags;
	}

	/** Whether the current actor is matched by any tag of this object. */
	async canRead(objectId: string): Promise<boolean> {
		const tags = actorTags();
		if (tags.length === 0) return false;
		const row = await this.db
			.selectFrom(ACCESS_TAGS_TABLE)
			.select("objectId")
			.where("objectId", "=", objectId)
			.where("tag", "in", tags)
			.limit(1)
			.executeTakeFirst();
		return row !== undefined;
	}

	/** Same check, but throws — for the top of a read handler. */
	async requireRead(objectId: string): Promise<void> {
		if (!(await this.canRead(objectId))) throw new AccessDeniedError(objectId);
	}

	/**
	 * Whether the object is the actor's own — matched by their personal tag or by
	 * one of their groups, and not merely by being open.
	 *
	 * The distinction is the whole of "a user edits only what is theirs, a
	 * moderator edits anything in their section": the moderator holds a group tag
	 * the object also carries, the passer-by holds nothing but `public`.
	 */
	async canWrite(objectId: string): Promise<boolean> {
		const tags = identityTags();
		if (tags.length === 0) return false;
		const row = await this.db
			.selectFrom(ACCESS_TAGS_TABLE)
			.select("objectId")
			.where("objectId", "=", objectId)
			.where("tag", "in", tags)
			.limit(1)
			.executeTakeFirst();
		return row !== undefined;
	}

	/** Same check, but throws — for the top of a write handler. */
	async requireWrite(objectId: string): Promise<void> {
		if (!(await this.canWrite(objectId))) throw new AccessDeniedError(objectId);
	}

	/** Whether a specific person is matched, regardless of who is calling. */
	async isGrantedTo(objectId: string, userId: string): Promise<boolean> {
		const row = await this.db
			.selectFrom(ACCESS_TAGS_TABLE)
			.select("objectId")
			.where("objectId", "=", objectId)
			.where("tag", "=", personalTag(userId))
			.limit(1)
			.executeTakeFirst();
		return row !== undefined;
	}

	/** Opens one object to one person. The individual case, effective at once. */
	async grantToUser(objectId: string, userId: string): Promise<void> {
		await this.grant(objectId, personalTag(userId));
	}

	async revokeFromUser(objectId: string, userId: string): Promise<void> {
		await this.revoke(objectId, personalTag(userId));
	}
}

function normalize(tags: readonly string[]): string[] {
	const seen = new Set<string>();
	for (const tag of tags) {
		const normalized = tag.trim();
		if (normalized) seen.add(normalized);
	}
	return [...seen];
}
