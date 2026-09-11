import { SqlMigration } from "../engines/sql/sql-migration";
import type { SqlStore } from "../engines/sql/sql-store";

export const ACCESS_TAGS_TABLE = "access_tags";

/**
 * One tag table per store, serving every object type in it.
 *
 * There is no object-type column: the `JOIN` back to the owning table does that
 * filtering, because an id belonging to another type simply will not be found
 * there. What this relies on is that ids are unique across the tables covered
 * by tags — a shared sequence, a UUID, or a type prefix, whichever the store
 * already uses.
 *
 * The primary key is `(tag, objectId)` and not the reverse: selections start
 * from a tag and walk its objects, which is the whole point of the design, and
 * that is the order this key gives them for free.
 */
export class AccessTagsMigration extends SqlMigration {
	constructor(store: SqlStore) {
		super("create_access_tags", store);
	}

	async up(): Promise<void> {
		await this.store.db.schema
			.createTable(ACCESS_TAGS_TABLE)
			.ifNotExists()
			.addColumn("objectId", "text", (col) => col.notNull())
			.addColumn("tag", "text", (col) => col.notNull())
			.addPrimaryKeyConstraint("access_tags_pk", ["tag", "objectId"])
			.execute();

		// The reverse direction: "which tags does this object carry", needed to
		// show and edit an object's access and to drop it on delete.
		await this.store.db.schema
			.createIndex("access_tags_object")
			.ifNotExists()
			.on(ACCESS_TAGS_TABLE)
			.column("objectId")
			.execute();
	}

	async down(): Promise<void> {
		await this.store.db.schema
			.dropTable(ACCESS_TAGS_TABLE)
			.ifExists()
			.execute();
	}
}
