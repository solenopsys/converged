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

const metadata: ServiceMetadata = {
  "interfaceName": "EventsService",
  "serviceName": "events",
  "filePath": "business/events.ts",
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
      "definition": "{\n\tid: EventId;\n\tcreatedAt: ISODateString;\n\ttype: string;\n\tservice: string;\n\tentityId: string;\n\n\tparentId?: string;\n\n\tlabel?: string;\n}"
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
