import {
	AccessTags,
	generateULID,
	type SqlStore,
	visibleFrom,
} from "back-core";
import type { BusinessEvent, BusinessEventInput, EventId } from "../../types";

type EventEntity = {
	id: string;
	createdAt: string;
	type: string;
	service: string;
	entityId: string;
	parentId: string | null;
	label: string | null;
};

type EventsDatabase = {
	events: EventEntity;
};

const TABLE_NAME = "events";

export class EventsStoreService {
	/**
	 * Who may see which event.
	 *
	 * An event names an object in another service, and this service cannot ask
	 * that service who may see it — that is the invariant the whole scheme is
	 * built on. So the decision is made here, at publish time, from the caller
	 * that is publishing: the event is `authenticated`, which is the activity
	 * feed the business had before, and carries the publisher's tag so a feed
	 * for one team is a grant away rather than a rewrite.
	 */
	readonly access: AccessTags;

	constructor(private store: SqlStore<EventsDatabase>) {
		this.access = new AccessTags(store as any);
	}

	async publish(input: BusinessEventInput): Promise<EventId> {
		this.validateInput(input);

		const id = generateULID();
		const entity: EventEntity = {
			id,
			createdAt: input.createdAt ?? new Date().toISOString(),
			type: input.type,
			service: input.service,
			entityId: input.entityId,
			parentId: input.parentId ?? null,
			label: input.label ?? null,
		};

		await this.store.db.insertInto(TABLE_NAME).values(entity).execute();
		// `tags` from the payload would be the caller granting itself an audience,
		// so there are none: the owner comes from the token and nothing else.
		await this.access.tagNew(id, { visibility: "authenticated" });

		return id;
	}

	async listEvents(offset: number, limit: number): Promise<BusinessEvent[]> {
		const rows = await visibleFrom(this.store.db as any, TABLE_NAME)
			.selectAll("obj")
			.orderBy("obj.createdAt", "desc")
			.orderBy("obj.id", "desc")
			.limit(limit)
			.offset(offset)
			.execute();

		return rows.map((row) => this.toBusinessEvent(row));
	}

	private validateInput(input: BusinessEventInput): void {
		for (const field of ["type", "service", "entityId"] as const) {
			if (!input[field]?.trim()) {
				const error = new Error(`${field} is required`) as Error & {
					statusCode?: number;
				};
				error.statusCode = 400;
				throw error;
			}
		}
	}

	private toBusinessEvent(row: EventEntity): BusinessEvent {
		return {
			id: row.id,
			createdAt: row.createdAt,
			type: row.type,
			service: row.service,
			entityId: row.entityId,
			...(row.parentId ? { parentId: row.parentId } : {}),
			...(row.label ? { label: row.label } : {}),
		};
	}
}
