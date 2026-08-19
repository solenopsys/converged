export type EventId = string;
export type ISODateString = string;

export type BusinessEvent = {
	id: EventId;
	createdAt: ISODateString;
	type: string;
	service: string;
	entityId: string;

	parentId?: string;

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
