// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

export type EventSource = "webhook" | "cron" | "service" | "ui";

export type BusEventInput = {
	/** Topic. Dot-separated, entity id included: `order.updated.42`. */
	name: string;
	/** Tenant. Service callers may name another one; user callers cannot. */
	scope?: string;
	source?: EventSource;
	/** Subject that caused the event, when a person did. */
	actor?: string;
	correlationId?: string;
	/**
	 * Idempotency key. Travels with the event so a consumer can drop a repeat
	 * on its own — the property that keeps a future clustered Fujin honest.
	 */
	dedupKey?: string;
	payload?: unknown;
};

export type BusEvent = {
	id: string;
	name: string;
	scope: string;
	source: EventSource;
	at: number;
	actor?: string;
	correlationId?: string;
	dedupKey?: string;
	payload?: unknown;
};

export type PublishResult = {
	id: string;
	/** Runtime peers the event was handed to. */
	peers: number;
	/** Live browser sessions that matched. */
	sessions: number;
};

export type SubscribeResult = {
	/** Patterns this connection holds after the call. */
	patterns: string[];
};

export type ReplayParams = {
	/** Exclusive lower bound, an event id from an earlier delivery. */
	since?: string;
	/** Topic patterns; empty means everything the scope allows. */
	patterns?: string[];
	limit?: number;
};

export type ReplayResult = {
	events: BusEvent[];
	/** Cursor to pass as `since` next time; empty when nothing came back. */
	cursor: string;
};

export type SubscriptionState = {
	/** `peer:<target>` or `session:<id>`. */
	owner: string;
	patterns: string[];
};

const metadata: ServiceMetadata = {
  "interfaceName": "BusService",
  "serviceName": "bus",
  "target": "fujin",
  "filePath": "platform/bus.ts",
  "methods": [
    {
      "name": "publish",
      "parameters": [
        {
          "name": "event",
          "type": "BusEventInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PublishResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "subscribe",
      "parameters": [
        {
          "name": "patterns",
          "type": "string",
          "optional": false,
          "isArray": true
        }
      ],
      "returnType": "SubscribeResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "unsubscribe",
      "parameters": [
        {
          "name": "patterns",
          "type": "string",
          "optional": false,
          "isArray": true
        }
      ],
      "returnType": "SubscribeResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "replay",
      "parameters": [
        {
          "name": "params",
          "type": "ReplayParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "ReplayResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "subscriptions",
      "parameters": [],
      "returnType": "SubscriptionState",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "EventSource",
      "kind": "type",
      "definition": "\"webhook\" | \"cron\" | \"service\" | \"ui\""
    },
    {
      "name": "BusEventInput",
      "kind": "type",
      "definition": "{\n\t/** Topic. Dot-separated, entity id included: `order.updated.42`. */\n\tname: string;\n\t/** Tenant. Service callers may name another one; user callers cannot. */\n\tscope?: string;\n\tsource?: EventSource;\n\t/** Subject that caused the event, when a person did. */\n\tactor?: string;\n\tcorrelationId?: string;\n\t/**\n\t * Idempotency key. Travels with the event so a consumer can drop a repeat\n\t * on its own — the property that keeps a future clustered Fujin honest.\n\t */\n\tdedupKey?: string;\n\tpayload?: unknown;\n}"
    },
    {
      "name": "BusEvent",
      "kind": "type",
      "definition": "{\n\tid: string;\n\tname: string;\n\tscope: string;\n\tsource: EventSource;\n\tat: number;\n\tactor?: string;\n\tcorrelationId?: string;\n\tdedupKey?: string;\n\tpayload?: unknown;\n}"
    },
    {
      "name": "PublishResult",
      "kind": "type",
      "definition": "{\n\tid: string;\n\t/** Runtime peers the event was handed to. */\n\tpeers: number;\n\t/** Live browser sessions that matched. */\n\tsessions: number;\n}"
    },
    {
      "name": "SubscribeResult",
      "kind": "type",
      "definition": "{\n\t/** Patterns this connection holds after the call. */\n\tpatterns: string[];\n}"
    },
    {
      "name": "ReplayParams",
      "kind": "type",
      "definition": "{\n\t/** Exclusive lower bound, an event id from an earlier delivery. */\n\tsince?: string;\n\t/** Topic patterns; empty means everything the scope allows. */\n\tpatterns?: string[];\n\tlimit?: number;\n}"
    },
    {
      "name": "ReplayResult",
      "kind": "type",
      "definition": "{\n\tevents: BusEvent[];\n\t/** Cursor to pass as `since` next time; empty when nothing came back. */\n\tcursor: string;\n}"
    },
    {
      "name": "SubscriptionState",
      "kind": "type",
      "definition": "{\n\t/** `peer:<target>` or `session:<id>`. */\n\towner: string;\n\tpatterns: string[];\n}"
    }
  ]
};

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface BusServiceRtClient {
  publish(event: BusEventInput): PublishResult;
  subscribe(patterns: string[]): SubscribeResult;
  unsubscribe(patterns: string[]): SubscribeResult;
  replay(params: ReplayParams): ReplayResult;
  subscriptions(): SubscriptionState[];
}

export function createBusServiceRtClient(): BusServiceRtClient {
  return createRtClient<BusServiceRtClient>(metadata);
}
