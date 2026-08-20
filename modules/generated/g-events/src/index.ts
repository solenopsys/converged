// Auto-generated native NRPC package
import {
  createCrullerTransportClient,
  type CrullerTransportClientConfig,
  type ServiceMetadata,
} from "nrpc";

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

export const metadata: ServiceMetadata = {
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

// Server interface (to be implemented in microservice)
export interface EventsService {
  publish(input: BusinessEventInput): Promise<EventId>;
  listEvents(offset: number, limit: number): Promise<BusinessEvent[]>;
}

// Client interface
export interface EventsServiceClient {
  publish(input: BusinessEventInput): Promise<EventId>;
  listEvents(offset: number, limit: number): Promise<BusinessEvent[]>;
}

// Native factory: cruller-transport -> Fujin -> cluster peer.
// Package exports select this entrypoint outside a browser build.
export function createEventsServiceClient(
  config: CrullerTransportClientConfig,
): EventsServiceClient {
  return createCrullerTransportClient<EventsServiceClient>(metadata, config);
}

export function createEventsServiceCrullerTransportClient(
  config: CrullerTransportClientConfig,
): EventsServiceClient {
  return createEventsServiceClient(config);
}
