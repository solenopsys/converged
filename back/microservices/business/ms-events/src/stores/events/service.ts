import { generateULID, type SqlStore } from "back-core";
import type { BusinessEvent, BusinessEventInput, EventId } from "../../types";

type EventEntity = {
	id: string;
	createdAt: string;
	type: string;
	service: string;
	entityId: string;
};

type EventsDatabase = {
	events: EventEntity;
};

const TABLE_NAME = "events";

export class EventsStoreService {
	constructor(private store: SqlStore<EventsDatabase>) {}

	async publish(input: BusinessEventInput): Promise<EventId> {
		this.validateInput(input);

		const id = generateULID();
		const entity: EventEntity = {
			id,
			createdAt: input.createdAt ?? new Date().toISOString(),
			type: input.type,
			service: input.service,
			entityId: input.entityId,
		};

		await this.store.db.insertInto(TABLE_NAME).values(entity).execute();

		return id;
	}

	async listEvents(offset: number, limit: number): Promise<BusinessEvent[]> {
		const rows = await this.store.db
			.selectFrom(TABLE_NAME)
			.selectAll()
			.orderBy("createdAt", "desc")
			.orderBy("id", "desc")
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
		};
	}
}
