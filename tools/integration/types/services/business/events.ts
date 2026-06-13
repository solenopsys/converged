export type EventId = string;
export type ISODateString = string;

export type BusinessEvent = {
	id: EventId;
	createdAt: ISODateString;
	type: string;
	service: string;
	entityId: string;
	/** Correlation id of the process that produced this event (workflow run,
	 * call session, upload batch). Events sharing a parentId are grouped. */
	parentId?: string;
	/** Human-readable label for the entity (e.g. file name) so the feed shows
	 * something meaningful instead of a raw UUID. */
	label?: string;
};

export type BusinessEventInput = {
	createdAt?: ISODateString;
	type: string;
	service: string;
	entityId: string;
	parentId?: string;
	label?: string;
};

export interface EventsService {
	publish(input: BusinessEventInput): Promise<EventId>;
	listEvents(offset: number, limit: number): Promise<BusinessEvent[]>;
}
