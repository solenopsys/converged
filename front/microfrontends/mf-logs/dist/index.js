// src/views/LogsView.tsx
import { useEffect } from "react";
import { useUnit } from "effector-react";
import { HeaderPanel, InfiniteScrollDataTable } from "front-core";
import { RefreshCw } from "lucide-react";

// src/domain-logs.ts
import { createDomain, sample } from "effector";
import { createInfiniteTableStore } from "front-core";

// ../../../integration/nrpc/src/runtime/serialization.ts
class TypeHandlerRegistry {
  handlers = new Map;
  autoDetectHandlers = [];
  register(typeName, handler) {
    this.handlers.set(typeName, handler);
    if (handler.detect) {
      this.autoDetectHandlers.push({
        detect: handler.detect,
        deserialize: handler.deserialize
      });
    }
  }
  getHandler(typeName) {
    return this.handlers.get(typeName);
  }
  autoDetectAndDeserialize(value) {
    for (const handler of this.autoDetectHandlers) {
      if (handler.detect(value)) {
        return handler.deserialize(value);
      }
    }
    return value;
  }
}
var registry = new TypeHandlerRegistry;
registry.register("Date", {
  serialize: (value) => {
    if (value instanceof Date) {
      return value.toISOString();
    }
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
    return value;
  },
  deserialize: (value) => new Date(value),
  detect: (value) => {
    if (typeof value !== "string")
      return false;
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    if (!isoDateRegex.test(value))
      return false;
    const date = new Date(value);
    return !isNaN(date.getTime());
  }
});
registry.register("Uint8Array", {
  serialize: (value) => {
    if (value instanceof Uint8Array) {
      let binary = "";
      for (let i = 0;i < value.byteLength; i++) {
        binary += String.fromCharCode(value[i]);
      }
      return { __type: "Uint8Array", data: btoa(binary) };
    }
    return value;
  },
  deserialize: (value) => {
    if (typeof value === "object" && value.__type === "Uint8Array" && typeof value.data === "string") {
      const binary = atob(value.data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0;i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }
    if (typeof value === "string") {
      try {
        const binary = atob(value);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0;i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
      } catch {
        return value;
      }
    }
    return value;
  },
  detect: (value) => {
    return typeof value === "object" && value !== null && value.__type === "Uint8Array";
  }
});
function serializeValue(value, typeName) {
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => serializeValue(item, typeName));
  }
  if (typeName) {
    const handler = registry.getHandler(typeName);
    if (handler && value.constructor.name === typeName) {
      return handler.serialize(value);
    }
  }
  const handlerForType = registry.getHandler(value.constructor.name);
  if (handlerForType) {
    return handlerForType.serialize(value);
  }
  if (typeof value === "object") {
    const result = {};
    for (const key in value) {
      if (value.hasOwnProperty(key)) {
        result[key] = serializeValue(value[key]);
      }
    }
    return result;
  }
  return value;
}
function deserializeValue(value, typeName) {
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => deserializeValue(item, typeName));
  }
  if (typeName) {
    const handler = registry.getHandler(typeName);
    if (handler) {
      return handler.deserialize(value);
    }
  }
  if (typeof value === "object") {
    const result = {};
    for (const key in value) {
      if (value.hasOwnProperty(key)) {
        const childValue = value[key];
        const detected = registry.autoDetectAndDeserialize(childValue);
        result[key] = detected !== childValue ? detected : deserializeValue(childValue);
      }
    }
    return result;
  }
  return registry.autoDetectAndDeserialize(value);
}

// ../../../integration/nrpc/src/runtime/access-control.ts
var WILDCARDS = new Set(["*", "all"]);

// ../../../integration/nrpc/src/runtime/http-client.ts
function createHttpClient(metadata, config = {}) {
  const client = new HttpClientImpl(metadata, config);
  return createProxy(client, metadata);
}

class HttpClientImpl {
  metadata;
  baseUrl;
  timeout;
  headers;
  constructor(metadata, config) {
    this.metadata = metadata;
    const envBase = typeof process !== "undefined" ? process.env?.SERVICES_BASE : undefined;
    this.baseUrl = config.baseUrl || envBase || "/services";
    this.timeout = config.timeout || 5000;
    this.headers = config.headers || {};
  }
  call(methodName, params) {
    const method = this.metadata.methods.find((m) => m.name === methodName);
    if (!method) {
      throw new Error(`Method ${methodName} not found in service ${this.metadata.serviceName}`);
    }
    if (method.isAsyncIterable) {
      return this.callStreaming(methodName, params);
    }
    return this.callRegular(methodName, params);
  }
  async callRegular(methodName, params) {
    const method = this.metadata.methods.find((m) => m.name === methodName);
    const path = `/${this.metadata.serviceName}/${methodName}`;
    const body = this.prepareParams(method.parameters, params);
    const abortController = new AbortController;
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, this.timeout);
    try {
      const url = `${this.baseUrl}${path}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.headers
        },
        body: JSON.stringify(body),
        signal: abortController.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        let errorMessage = `HTTP ${url} ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {}
        throw new Error(errorMessage);
      }
      if (method.returnType === "void") {
        return;
      }
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const data = await response.json();
        return deserializeValue(data, method.returnType);
      } else {
        return response.text();
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
      throw error;
    }
  }
  callStreaming(methodName, params) {
    const method = this.metadata.methods.find((m) => m.name === methodName);
    const path = `/${this.metadata.serviceName}/${methodName}/stream`;
    const body = this.prepareParams(method.parameters, params);
    const self = this;
    return {
      async* [Symbol.asyncIterator]() {
        const abortController = new AbortController;
        const response = await fetch(`${self.baseUrl}${path}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            ...self.headers
          },
          body: JSON.stringify(body),
          signal: abortController.signal
        });
        if (!response.ok) {
          let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          try {
            const errorData = await response.json();
            if (errorData.error) {
              errorMessage = errorData.error;
            }
          } catch {}
          throw new Error(errorMessage);
        }
        if (!response.body) {
          throw new Error("Response body is null");
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder;
        try {
          let buffer = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done)
              break;
            buffer += decoder.decode(value, { stream: true });
            let eventStart = 0;
            let eventEnd = buffer.indexOf(`

`);
            while (eventEnd !== -1) {
              const eventData = buffer.slice(eventStart, eventEnd);
              const lines = eventData.split(`
`);
              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed)
                  continue;
                if (trimmed.startsWith("data: ")) {
                  const data = trimmed.slice(6);
                  if (data === "[DONE]") {
                    return;
                  }
                  try {
                    const parsed = JSON.parse(data);
                    const deserialized = deserializeValue(parsed, method.returnType);
                    yield deserialized;
                  } catch (error) {
                    console.error("Error parsing JSON data:", data, error);
                  }
                }
              }
              eventStart = eventEnd + 2;
              eventEnd = buffer.indexOf(`

`, eventStart);
            }
            buffer = buffer.slice(eventStart);
          }
        } finally {
          reader.releaseLock();
        }
      }
    };
  }
  prepareParams(paramDefs, params) {
    const result = {};
    paramDefs.forEach((def, index) => {
      if (params[index] !== undefined) {
        result[def.name] = serializeValue(params[index], def.type);
      } else if (!def.optional) {
        throw new Error(`Required parameter '${def.name}' is missing`);
      }
    });
    return result;
  }
}
function createProxy(client, metadata) {
  const proxy = {};
  metadata.methods.forEach((method) => {
    proxy[method.name] = (...args) => {
      const requiredParamsCount = method.parameters.filter((p) => !p.optional).length;
      const totalParamsCount = method.parameters.length;
      if (args.length < requiredParamsCount) {
        throw new Error(`Method ${method.name} requires at least ${requiredParamsCount} arguments, got ${args.length}`);
      }
      if (args.length > totalParamsCount) {
        throw new Error(`Method ${method.name} accepts at most ${totalParamsCount} arguments, got ${args.length}`);
      }
      return client.call(method.name, args);
    };
  });
  proxy._metadata = metadata;
  return proxy;
}

// ../../../integration/nrpc/src/decorator/access.decorator.ts
var JWT_SECRET = new TextEncoder().encode("your-secret-key");

// ../../../integration/generated/g-logs/src/index.ts
var metadata = {
  interfaceName: "LogsService",
  serviceName: "logs",
  filePath: "/home/alexstorm/distrib/4ir/gestalt/clarity/converged/integration/types/logs.ts",
  methods: [
    {
      name: "write",
      parameters: [
        {
          name: "event",
          type: "LogEventInput",
          optional: false,
          isArray: false
        }
      ],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false
    },
    {
      name: "listHot",
      parameters: [
        {
          name: "params",
          type: "LogQueryParams",
          optional: false,
          isArray: false
        }
      ],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false
    },
    {
      name: "listCold",
      parameters: [
        {
          name: "params",
          type: "LogQueryParams",
          optional: false,
          isArray: false
        }
      ],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false
    },
    {
      name: "flushHot",
      parameters: [
        {
          name: "date",
          type: "string",
          optional: true,
          isArray: false
        }
      ],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false
    },
    {
      name: "flushOldHot",
      parameters: [],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false
    },
    {
      name: "restoreHot",
      parameters: [
        {
          name: "params",
          type: "LogRestoreParams",
          optional: true,
          isArray: false
        }
      ],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false
    }
  ],
  types: [
    {
      name: "LogEvent",
      definition: `{
  ts: number;
  source: string;
  level: number;
  code: number;
  message: string;
}`
    },
    {
      name: "LogEventInput",
      definition: `{
  ts?: number;
  source: string;
  level: number;
  code: number;
  message: string;
}`
    },
    {
      name: "LogQueryParams",
      definition: `{
  offset: number;
  limit: number;
  source?: string;
  level?: number;
  code?: number;
  from_ts?: number;
  to_ts?: number;
}`
    },
    {
      name: "LogRestoreParams",
      definition: `{
  source?: string;
  level?: number;
  code?: number;
  from_ts?: number;
  to_ts?: number;
  batchSize?: number;
}`
    },
    {
      name: "PaginatedResult",
      definition: "",
      properties: [
        {
          name: "items",
          type: "T",
          optional: false,
          isArray: true
        },
        {
          name: "totalCount",
          type: "number",
          optional: true,
          isArray: false
        }
      ]
    }
  ]
};
function createLogsServiceClient(config) {
  return createHttpClient(metadata, config);
}
var logsClient = createLogsServiceClient();

// src/service.ts
var service_default = logsClient;

// src/domain-logs.ts
var domain = createDomain("logs");
var logsViewMounted = domain.createEvent("LOGS_VIEW_MOUNTED");
var refreshLogsClicked = domain.createEvent("REFRESH_LOGS_CLICKED");
var $logsMode = domain.createStore("hot");
$logsMode.on(logsViewMounted, (_state, payload) => payload.mode);
var listLogsFx = domain.createEffect({
  name: "LIST_LOGS",
  handler: async (params) => {
    const mode = $logsMode.getState();
    return mode === "cold" ? await service_default.listCold(params) : await service_default.listHot(params);
  }
});
var $logsStore = createInfiniteTableStore(domain, listLogsFx);
sample({
  clock: logsViewMounted,
  fn: () => ({}),
  target: $logsStore.reset
});
sample({
  clock: logsViewMounted,
  fn: () => ({}),
  target: $logsStore.loadMore
});
sample({
  clock: refreshLogsClicked,
  fn: () => ({}),
  target: $logsStore.reset
});
sample({
  clock: refreshLogsClicked,
  fn: () => ({}),
  target: $logsStore.loadMore
});

// src/functions/columns.ts
import { getTableColumns } from "front-core";

// src/functions/fields.ts
var FIELD_TYPES = {
  TEXT: "text",
  NUMBER: "number",
  DATE: "date"
};
var logsFields = [
  {
    id: "ts",
    title: "Timestamp",
    type: FIELD_TYPES.DATE,
    tableVisible: true,
    width: 160
  },
  {
    id: "source",
    title: "Source",
    type: FIELD_TYPES.TEXT,
    tableVisible: true,
    minWidth: 160
  },
  {
    id: "level",
    title: "Level",
    type: FIELD_TYPES.NUMBER,
    tableVisible: true,
    width: 80
  },
  {
    id: "code",
    title: "Code",
    type: FIELD_TYPES.NUMBER,
    tableVisible: true,
    width: 80
  },
  {
    id: "message",
    title: "Message",
    type: FIELD_TYPES.TEXT,
    tableVisible: true,
    minWidth: 320
  }
];

// src/functions/columns.ts
var logsColumns = getTableColumns(logsFields);

// src/views/LogsView.tsx
import { jsxDEV } from "react/jsx-dev-runtime";
var LogsView = ({ mode = "hot" }) => {
  const logsState = useUnit($logsStore.$state);
  useEffect(() => {
    logsViewMounted({ mode });
  }, [mode]);
  const headerConfig = {
    title: "Logs",
    actions: [
      {
        id: "refresh",
        label: "Refresh",
        icon: RefreshCw,
        event: refreshLogsClicked,
        variant: "outline"
      }
    ]
  };
  return /* @__PURE__ */ jsxDEV("div", {
    className: "flex flex-col h-full",
    children: [
      /* @__PURE__ */ jsxDEV(HeaderPanel, {
        config: headerConfig
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV("div", {
        className: "flex-1 overflow-hidden p-4",
        children: /* @__PURE__ */ jsxDEV(InfiniteScrollDataTable, {
          data: logsState.items,
          hasMore: logsState.hasMore,
          loading: logsState.loading,
          columns: logsColumns,
          onLoadMore: $logsStore.loadMore,
          viewMode: "table"
        }, undefined, false, undefined, this)
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
};

// src/functions.ts
var SHOW_LOGS = "logs.show";
var SHOW_LOGS_COLD = "logs.show.cold";
var createLogsWidget = (_bus, params) => ({
  view: LogsView,
  placement: () => "center",
  config: {
    mode: params?.mode ?? "hot"
  }
});
var createShowLogsAction = (bus) => ({
  id: SHOW_LOGS,
  description: "Show hot logs",
  invoke: () => {
    bus.present({ widget: createLogsWidget(bus, { mode: "hot" }) });
  }
});
var createShowLogsColdAction = (bus) => ({
  id: SHOW_LOGS_COLD,
  description: "Show cold logs",
  invoke: () => {
    bus.present({ widget: createLogsWidget(bus, { mode: "cold" }) });
  }
});
var ACTIONS = [createShowLogsAction, createShowLogsColdAction];
var functions_default = ACTIONS;

// src/menu.ts
var MENU = {
  title: "menu.logs",
  iconName: "IconListDetails",
  items: [
    {
      title: "menu.hot",
      key: "hot",
      action: SHOW_LOGS
    },
    {
      title: "menu.cold",
      key: "cold",
      action: SHOW_LOGS_COLD
    }
  ]
};
// src/index.ts
import { BasePlugin } from "front-core";
var ID = "logs-mf";
var src_default = new BasePlugin(ID, functions_default);
export {
  src_default as default,
  MENU,
  ID
};
