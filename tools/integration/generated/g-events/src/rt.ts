// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

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

const metadata: ServiceMetadata = {
  "interfaceName": "EventsService",
  "serviceName": "events",
  "filePath": "services/business/events.ts",
  "methods": [
    {
      "name": "publish",
      "parameters": [
        {
          "name": "input",
          "type": "BusinessEventInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "EventId",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listEvents",
      "parameters": [
        {
          "name": "offset",
          "type": "number",
          "optional": false,
          "isArray": false
        },
        {
          "name": "limit",
          "type": "number",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "BusinessEvent",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "EventId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "ISODateString",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "BusinessEvent",
      "kind": "type",
      "definition": "{\n\tid: EventId;\n\tcreatedAt: ISODateString;\n\ttype: string;\n\tservice: string;\n\tentityId: string;\n\t/** Correlation id of the process that produced this event (workflow run,\n\t * call session, upload batch). Events sharing a parentId are grouped. */\n\tparentId?: string;\n\t/** Human-readable label for the entity (e.g. file name) so the feed shows\n\t * something meaningful instead of a raw UUID. */\n\tlabel?: string;\n}"
    },
    {
      "name": "BusinessEventInput",
      "kind": "type",
      "definition": "{\n\tcreatedAt?: ISODateString;\n\ttype: string;\n\tservice: string;\n\tentityId: string;\n\tparentId?: string;\n\tlabel?: string;\n}"
    }
  ]
};

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface EventsServiceRtClient {
  publish(input: BusinessEventInput): EventId;
  listEvents(offset: number, limit: number): BusinessEvent[];
}

export function createEventsServiceRtClient(): EventsServiceRtClient {
  return createRtClient<EventsServiceRtClient>(metadata);
}
