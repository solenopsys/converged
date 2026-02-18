// src/functions/wokflow.ts
import { BasicFormView, getAllFormFields, StatCard } from "front-core";
import { sample as sample4 } from "effector";

// src/functions/fields.ts
var FIELD_TYPES = {
  TEXT: "text",
  NUMBER: "number",
  DATE: "date",
  SELECT: "select",
  TEXTAREA: "textarea"
};
var workflowsFields = [
  {
    id: "name",
    title: "Name",
    type: FIELD_TYPES.TEXT,
    tableVisible: true,
    formVisible: true,
    minWidth: 200,
    required: true,
    placeholder: "Enter workflow name..."
  },
  {
    id: "description",
    title: "Description",
    type: FIELD_TYPES.TEXTAREA,
    tableVisible: true,
    formVisible: true,
    minWidth: 300,
    placeholder: "Enter description...",
    rows: 3
  },
  {
    id: "nodesCount",
    title: "Nodes",
    type: FIELD_TYPES.NUMBER,
    tableVisible: true,
    formVisible: false,
    width: 100
  }
];
var nodesFields = [
  {
    id: "name",
    title: "Name",
    type: FIELD_TYPES.TEXT,
    tableVisible: true,
    formVisible: true,
    minWidth: 200,
    required: true,
    placeholder: "Enter node name..."
  },
  {
    id: "codeSource",
    title: "Code Source",
    type: FIELD_TYPES.SELECT,
    tableVisible: true,
    formVisible: true,
    minWidth: 200,
    required: true,
    placeholder: "Select code source...",
    options: []
  },
  {
    id: "description",
    title: "Description",
    type: FIELD_TYPES.TEXTAREA,
    tableVisible: false,
    formVisible: true,
    placeholder: "Enter description...",
    rows: 3
  }
];
var providersFields = [
  {
    id: "name",
    title: "Name",
    type: FIELD_TYPES.TEXT,
    tableVisible: true,
    formVisible: true,
    minWidth: 200,
    required: true,
    placeholder: "Enter provider name..."
  },
  {
    id: "codeSource",
    title: "Code Source",
    type: FIELD_TYPES.SELECT,
    tableVisible: true,
    formVisible: true,
    minWidth: 200,
    required: true,
    placeholder: "Select code source...",
    options: []
  },
  {
    id: "description",
    title: "Description",
    type: FIELD_TYPES.TEXTAREA,
    tableVisible: false,
    formVisible: true,
    placeholder: "Enter description...",
    rows: 3
  }
];

// src/domain.ts
import { createDomain, sample } from "effector";
import { createDomainLogger } from "front-core";

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

// ../../../integration/generated/g-dag/src/index.ts
var metadata = {
  interfaceName: "DagService",
  serviceName: "dag",
  filePath: "/home/alexstorm/distrib/4ir/gestalt/clarity/converged/integration/types/dag.ts",
  methods: [
    {
      name: "status",
      parameters: [],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false
    },
    {
      name: "createContext",
      parameters: [
        {
          name: "workflowName",
          type: "string",
          optional: false,
          isArray: false
        },
        {
          name: "params",
          type: "Record",
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
      name: "emit",
      parameters: [
        {
          name: "contextId",
          type: "string",
          optional: false,
          isArray: false
        },
        {
          name: "event",
          type: "string",
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
      name: "getContext",
      parameters: [
        {
          name: "contextId",
          type: "string",
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
      name: "listContexts",
      parameters: [
        {
          name: "params",
          type: "any",
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
      name: "getStats",
      parameters: [
        {
          name: "workflowName",
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
      name: "getNodeProcessorStats",
      parameters: [],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false
    }
  ],
  types: [
    {
      name: "ContextStatus",
      definition: '"running" | "done" | "failed"'
    },
    {
      name: "MessageStatus",
      definition: '"queued" | "processing" | "done" | "failed"'
    },
    {
      name: "ContextInfo",
      definition: `{
  id: string;
  workflowName: string;
  status: ContextStatus;
  startedAt: number;
  updatedAt: number;
}`
    }
  ]
};
function createDagServiceClient(config) {
  return createHttpClient(metadata, config);
}
var dagClient = createDagServiceClient();

// src/service.ts
var service_default = dagClient;

// src/domain.ts
var domain = createDomain("dag");
createDomainLogger(domain);
var loadCodeSourcesFx = domain.createEffect({
  handler: async () => {
    const result = await service_default.codeSourceList();
    return result.names;
  }
});
var $codeSources = domain.createStore([]).on(loadCodeSourcesFx.doneData, (_, names) => names);
var $codeSourceOptions = $codeSources.map((sources) => sources.map((name) => ({ value: name, label: name })));
var loadProviderCodeSourcesFx = domain.createEffect({
  handler: async () => {
    const result = await service_default.providerCodeSourceList();
    return result.names;
  }
});
var $providerCodeSources = domain.createStore([]).on(loadProviderCodeSourcesFx.doneData, (_, names) => names);
var $providerCodeSourceOptions = $providerCodeSources.map((sources) => sources.map((name) => ({ value: name, label: name })));
var loadProvidersListFx = domain.createEffect({
  handler: async () => {
    const result = await service_default.providerList();
    return result.names;
  }
});
var $providersList = domain.createStore([]).on(loadProvidersListFx.doneData, (_, names) => names);
var $providersOptions = $providersList.map((providers) => providers.map((name) => ({ value: name, label: name })));
var loadNodesListFx = domain.createEffect({
  handler: async () => {
    const result = await service_default.nodeList();
    return result.names;
  }
});
var $nodesList = domain.createStore([]).on(loadNodesListFx.doneData, (_, names) => names);
var $nodesOptions = $nodesList.map((nodes) => nodes.map((name) => ({ value: name, label: name })));
var initDagData = domain.createEvent();
sample({
  clock: initDagData,
  target: [loadCodeSourcesFx, loadProvidersListFx, loadNodesListFx]
});
var domain_default = domain;

// src/components/nodeUtils.tsx
var createNodeMap = (config) => {
  const nodeMap = new Map;
  Object.keys(config.nodes).forEach((nodeName) => {
    nodeMap.set(nodeName, []);
  });
  Object.entries(config.links).forEach(([fromNode, toNode]) => {
    if (nodeMap.has(fromNode)) {
      const connections = nodeMap.get(fromNode);
      connections.push(toNode);
    }
  });
  return nodeMap;
};

// src/views/DagView.tsx
import { sample as sample2 } from "effector";
import { useStore } from "effector-react";
import { useEffect as useEffect2 } from "react";

// src/components/DagViewer/index.tsx
import { useEffect, useState, useRef, useMemo } from "react";

// src/components/DagViewer/Engine.ts
class DAGEngine {
  nodes = new Set;
  edges = new Map;
  listeners = new Map;
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }
  emit(event) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const nodes = Array.from(this.nodes);
      const edges = this.getEdgesArray();
      callbacks.forEach((callback) => callback(nodes, edges));
    }
  }
  addNode(name) {
    if (this.nodes.has(name))
      return false;
    this.nodes.add(name);
    this.edges.set(name, new Set);
    this.emit("change");
    return true;
  }
  removeNode(name) {
    if (!this.nodes.has(name))
      return false;
    this.nodes.delete(name);
    this.edges.delete(name);
    for (const [, targets] of this.edges) {
      targets.delete(name);
    }
    this.emit("change");
    return true;
  }
  addEdge(from, to) {
    if (!this.nodes.has(from) || !this.nodes.has(to))
      return false;
    if (from === to)
      return false;
    const fromEdges = this.edges.get(from);
    if (fromEdges.has(to))
      return false;
    if (this.wouldCreateCycle(from, to))
      return false;
    fromEdges.add(to);
    this.emit("change");
    return true;
  }
  removeEdge(from, to) {
    const fromEdges = this.edges.get(from);
    if (!fromEdges || !fromEdges.has(to))
      return false;
    fromEdges.delete(to);
    this.emit("change");
    return true;
  }
  clear() {
    this.nodes.clear();
    this.edges.clear();
    this.emit("change");
  }
  hasNode(name) {
    return this.nodes.has(name);
  }
  hasEdge(from, to) {
    return this.edges.get(from)?.has(to) || false;
  }
  getNodes() {
    return this.topologicalSort();
  }
  getEdges() {
    return this.getEdgesArray();
  }
  getOutgoing(node) {
    return Array.from(this.edges.get(node) || []);
  }
  getIncoming(node) {
    const incoming = [];
    for (const [from, targets] of this.edges) {
      if (targets.has(node)) {
        incoming.push(from);
      }
    }
    return incoming;
  }
  getNodeConnections(name) {
    return {
      incoming: this.getIncoming(name),
      outgoing: this.getOutgoing(name)
    };
  }
  topologicalSort() {
    const inDegree = new Map;
    const result = [];
    for (const node of this.nodes) {
      inDegree.set(node, 0);
    }
    for (const [, targets] of this.edges) {
      for (const target2 of targets) {
        inDegree.set(target2, inDegree.get(target2) + 1);
      }
    }
    const noIncomingNodes = [];
    for (const [node, degree] of inDegree) {
      if (degree === 0) {
        noIncomingNodes.push(node);
      }
    }
    noIncomingNodes.sort();
    const queue = [...noIncomingNodes];
    while (queue.length > 0) {
      const current = queue.shift();
      result.push(current);
      const targets = Array.from(this.edges.get(current));
      targets.sort();
      for (const target2 of targets) {
        const newDegree = inDegree.get(target2) - 1;
        inDegree.set(target2, newDegree);
        if (newDegree === 0) {
          queue.push(target2);
        }
      }
    }
    return result.length === this.nodes.size ? result : [];
  }
  hasCycle() {
    const visited = new Set;
    const recStack = new Set;
    const dfs = (node) => {
      visited.add(node);
      recStack.add(node);
      const targets = this.edges.get(node);
      for (const target2 of targets) {
        if (!visited.has(target2)) {
          if (dfs(target2))
            return true;
        } else if (recStack.has(target2)) {
          return true;
        }
      }
      recStack.delete(node);
      return false;
    };
    for (const node of this.nodes) {
      if (!visited.has(node)) {
        if (dfs(node))
          return true;
      }
    }
    return false;
  }
  wouldCreateCycle(from, to) {
    const visited = new Set;
    const dfs = (current) => {
      if (current === from)
        return true;
      if (visited.has(current))
        return false;
      visited.add(current);
      const targets = this.edges.get(current);
      if (!targets)
        return false;
      for (const target2 of targets) {
        if (dfs(target2))
          return true;
      }
      return false;
    };
    return dfs(to);
  }
  getEdgesArray() {
    const result = [];
    for (const [from, targets] of this.edges) {
      for (const to of targets) {
        result.push([from, to]);
      }
    }
    return result;
  }
}

// src/components/DagViewer/Theme.ts
var theme = {
  cellSize: 40,
  nodeRadius: 16,
  nodeSpacing: 40,
  leftMargin: 40,
  topOffset: 20,
  colors: {
    nodeBackground: "gray",
    nodeSelected: "hsl(var(--accent))",
    nodeBorder: "gray",
    nodeText: "white",
    entryPoint: "hsla(120, 100%, 50%, 0.7)",
    exitPoint: "hsla(0, 100%, 50%, 0.7)",
    connectionDefault: "hsl(var(--muted))",
    connectionIncoming: "hsl(120, 100%, 50%)",
    connectionOutgoing: "hsl(0, 100%, 50%)"
  },
  sizes: {
    nodeBorderWidth: 2,
    connectionPointRadius: 4,
    connectionWidth: 2,
    connectionHoveredWidth: 3
  },
  bezier: {
    baseOffset: 15,
    distanceMultiplier: 15
  },
  font: "lighter 14px Arial",
  getNodePosition: (index) => ({
    x: theme.leftMargin + theme.cellSize / 2,
    y: theme.topOffset + index * theme.cellSize
  }),
  getCellBounds: (index) => ({
    left: theme.leftMargin,
    top: theme.topOffset - theme.cellSize / 2 + index * theme.cellSize,
    right: theme.leftMargin + theme.cellSize,
    bottom: theme.topOffset + theme.cellSize / 2 + index * theme.cellSize,
    width: theme.cellSize,
    height: theme.cellSize
  }),
  validateNodeFitsInCell: () => {
    const maxNodeSize = theme.nodeRadius * 2;
    const availableSpace = theme.cellSize - 8;
    return maxNodeSize <= availableSpace;
  }
};

// src/components/DagViewer/Icons.ts
var LUCIDE_ICONS = {
  circle: {
    path: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
    viewBox: "0 0 24 24"
  },
  square: {
    path: "M3 3h18v18H3z",
    viewBox: "0 0 24 24"
  },
  triangle: {
    path: "M13.73 21a2 2 0 0 1-3.46 0l-8-14A2 2 0 0 1 4 4h16a2 2 0 0 1 1.73 3z",
    viewBox: "0 0 24 24"
  },
  database: {
    path: "M4 6c0-1.657 3.582-3 8-3s8 1.343 8 3v12c0 1.657-3.582 3-8 3s-8-1.343-8-3V6zm0 4c0 1.657 3.582 3 8 3s8-1.343 8-3m-16 4c0 1.657 3.582 3 8 3s8-1.343 8-3",
    viewBox: "0 0 24 24"
  },
  server: {
    path: "M6 10H4a2 2 0 0 1-2-2V4c0-1.1.9-2 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M6 10l6 6 6-6M6 10v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8",
    viewBox: "0 0 24 24"
  },
  hardDrive: {
    path: "M22 12H2l1.45-6.5A2 2 0 0 1 5.4 4h13.2a2 2 0 0 1 1.95 1.5L22 12zm0 0v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6h20zM6 16h.01M10 16h.01",
    viewBox: "0 0 24 24"
  },
  user: {
    path: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    viewBox: "0 0 24 24"
  },
  users: {
    path: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
    viewBox: "0 0 24 24"
  },
  userCheck: {
    path: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm7-3l2 2 4-4",
    viewBox: "0 0 24 24"
  },
  home: {
    path: "m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10",
    viewBox: "0 0 24 24"
  },
  settings: {
    path: "M12.22 2h-.44a2 2 0 0 0-2 1.8l-.17 1.46a.8.8 0 0 1-.32.62 8 8 0 0 0-.85.68.8.8 0 0 1-.64.15l-1.43-.34a2 2 0 0 0-2.37 1.05L3.8 8.77a2 2 0 0 0 .26 2.31l1.12 1.05a.8.8 0 0 1 .25.66 8 8 0 0 0 0 1.36.8.8 0 0 1-.25.66l-1.12 1.05a2 2 0 0 0-.26 2.31l.28.49a2 2 0 0 0 2.37 1.05l1.43-.34a.8.8 0 0 1 .64.15 8 8 0 0 0 .85.68.8.8 0 0 1 .32.62l.17 1.46a2 2 0 0 0 2 1.8h.44a2 2 0 0 0 2-1.8l.17-1.46a.8.8 0 0 1 .32-.62 8 8 0 0 0 .85-.68.8.8 0 0 1 .64-.15l1.43.34a2 2 0 0 0 2.37-1.05l.28-.49a2 2 0 0 0-.26-2.31l-1.12-1.05a.8.8 0 0 1-.25-.66 8 8 0 0 0 0-1.36.8.8 0 0 1 .25-.66l1.12-1.05a2 2 0 0 0 .26-2.31l-.28-.49a2 2 0 0 0-2.37-1.05l-1.43.34a.8.8 0 0 1-.64-.15 8 8 0 0 0-.85-.68.8.8 0 0 1-.32-.62L14.22 3.8a2 2 0 0 0-2-1.8z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    viewBox: "0 0 24 24"
  },
  menu: {
    path: "M4 6h16M4 12h16M4 18h16",
    viewBox: "0 0 24 24"
  },
  plus: {
    path: "M5 12h14m-7-7v14",
    viewBox: "0 0 24 24"
  },
  minus: {
    path: "M5 12h14",
    viewBox: "0 0 24 24"
  },
  edit: {
    path: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7m-1.5-6.5a2.12 2.12 0 0 1 3 3L12 20l-4 1 1-4 8.5-8.5z",
    viewBox: "0 0 24 24"
  },
  trash: {
    path: "M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-6 5v6m4-6v6",
    viewBox: "0 0 24 24"
  },
  copy: {
    path: "M20 9h-5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h5v5a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z",
    viewBox: "0 0 24 24"
  },
  check: {
    path: "m9 12 2 2 4-4",
    viewBox: "0 0 24 24"
  },
  x: {
    path: "m18 6-12 12M6 6l12 12",
    viewBox: "0 0 24 24"
  },
  alert: {
    path: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01",
    viewBox: "0 0 24 24"
  },
  info: {
    path: "M12 16v-4m0-4h.01M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10z",
    viewBox: "0 0 24 24"
  },
  arrowUp: {
    path: "m7 14 5-5 5 5",
    viewBox: "0 0 24 24"
  },
  arrowDown: {
    path: "m7 10 5 5 5-5",
    viewBox: "0 0 24 24"
  },
  arrowLeft: {
    path: "m15 18-6-6 6-6",
    viewBox: "0 0 24 24"
  },
  arrowRight: {
    path: "m9 18 6-6-6-6",
    viewBox: "0 0 24 24"
  },
  file: {
    path: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7l-5-5zM14 2v4a2 2 0 0 0 2 2h4",
    viewBox: "0 0 24 24"
  },
  folder: {
    path: "m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2",
    viewBox: "0 0 24 24"
  },
  star: {
    path: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
    viewBox: "0 0 24 24"
  },
  heart: {
    path: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z",
    viewBox: "0 0 24 24"
  },
  search: {
    path: "m21 21-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0z",
    viewBox: "0 0 24 24"
  },
  mail: {
    path: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zm16 2.38l-8 5-8-5V6l8 5 8-5v.38z",
    viewBox: "0 0 24 24"
  },
  calendar: {
    path: "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
    viewBox: "0 0 24 24"
  }
};

// src/components/DagViewer/Renderer.ts
class DAGRenderer {
  canvas;
  ctx;
  getNodeType;
  completedNodes;
  hoveredNode = null;
  selectedNodes = [];
  nodePositions = new Map;
  iconPaths = new Map;
  nodeTypeCache = new Map;
  constructor(canvas, getNodeType2, completedNodes) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D context");
    }
    this.ctx = ctx;
    this.getNodeType = getNodeType2;
    this.completedNodes = completedNodes;
    this.initializeIconPaths();
  }
  initializeIconPaths() {
    Object.entries(LUCIDE_ICONS).forEach(([name, icon]) => {
      const path2D = new Path2D(icon.path);
      this.iconPaths.set(name, path2D);
    });
  }
  getColor(colorValue) {
    if (colorValue.includes("var(")) {
      const temp = document.createElement("div");
      temp.style.color = colorValue;
      document.body.appendChild(temp);
      const computedColor = getComputedStyle(temp).color;
      document.body.removeChild(temp);
      return computedColor;
    }
    return colorValue;
  }
  calculatePositions(nodes) {
    this.nodePositions.clear();
    nodes.forEach((nodeName, index) => {
      this.nodePositions.set(nodeName, {
        x: theme.leftMargin + theme.cellSize / 2,
        y: theme.topOffset + index * theme.cellSize
      });
    });
  }
  getTotalHeight(nodeCount) {
    if (nodeCount === 0)
      return 0;
    return theme.topOffset + (nodeCount - 1) * theme.cellSize + theme.cellSize / 2;
  }
  getExitPoint(nodeName) {
    const pos = this.nodePositions.get(nodeName);
    if (!pos)
      throw new Error(`Node ${nodeName} not found`);
    return {
      x: pos.x - theme.nodeRadius,
      y: pos.y + theme.nodeRadius / 2
    };
  }
  getEntryPoint(nodeName) {
    const pos = this.nodePositions.get(nodeName);
    if (!pos)
      throw new Error(`Node ${nodeName} not found`);
    return {
      x: pos.x - theme.nodeRadius,
      y: pos.y - theme.nodeRadius / 2
    };
  }
  drawArrow(x, y, angle, size = 6) {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(angle);
    this.ctx.beginPath();
    this.ctx.moveTo(0, 0);
    this.ctx.lineTo(-size, -size / 2);
    this.ctx.lineTo(-size, size / 2);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.restore();
  }
  async renderIcon(nodeName, x, y, size = 16) {
    let iconName = this.nodeTypeCache.get(nodeName);
    if (!iconName) {
      try {
        iconName = await this.getNodeType(nodeName);
        this.nodeTypeCache.set(nodeName, iconName);
      } catch (error) {
        iconName = "circle";
        this.nodeTypeCache.set(nodeName, iconName);
      }
    }
    const iconPath = this.iconPaths.get(iconName);
    const iconDefinition = LUCIDE_ICONS[iconName];
    const roundedX = Math.round(x);
    const roundedY = Math.round(y);
    if (!iconPath || !iconDefinition) {
      this.ctx.fillStyle = this.getColor(theme.colors.nodeText);
      this.ctx.font = theme.font;
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText(nodeName.charAt(0).toUpperCase(), roundedX, roundedY);
      return;
    }
    this.ctx.save();
    this.ctx.translate(roundedX, roundedY);
    const viewBoxSize = 24;
    const scale = size / viewBoxSize;
    this.ctx.scale(scale, scale);
    this.ctx.translate(-12, -12);
    this.ctx.strokeStyle = this.getColor(theme.colors.nodeText);
    this.ctx.fillStyle = "none";
    this.ctx.lineWidth = 1.5;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.ctx.stroke(iconPath);
    this.ctx.restore();
  }
  async render(state, hoveredNode = null, selectedNodes = []) {
    this.hoveredNode = hoveredNode;
    this.selectedNodes = selectedNodes;
    this.completedNodes = state.completedNodes;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (state.nodes.length === 0)
      return;
    this.calculatePositions(state.nodes);
    this.renderConnections(state);
    await this.renderNodes(state);
  }
  renderConnections(state) {
    state.edges.forEach(([fromName, toName]) => {
      const fromPos = this.nodePositions.get(fromName);
      const toPos = this.nodePositions.get(toName);
      if (!fromPos || !toPos)
        return;
      const exitPoint = this.getExitPoint(fromName);
      const entryPoint = this.getEntryPoint(toName);
      const fromIndex = state.nodes.indexOf(fromName);
      const toIndex = state.nodes.indexOf(toName);
      const nodeDistance = Math.abs(toIndex - fromIndex);
      const controlOffset = theme.bezier.baseOffset + (nodeDistance - 1) * theme.bezier.distanceMultiplier;
      let strokeColor = this.getColor(theme.colors.connectionDefault);
      let lineWidth = Math.max(1, theme.sizes.connectionWidth - 1);
      if (this.hoveredNode !== null) {
        if (fromName === this.hoveredNode) {
          strokeColor = this.getColor(theme.colors.connectionOutgoing);
          lineWidth = Math.max(2, theme.sizes.connectionHoveredWidth - 1);
        } else if (toName === this.hoveredNode) {
          strokeColor = this.getColor(theme.colors.connectionIncoming);
          lineWidth = Math.max(2, theme.sizes.connectionHoveredWidth - 1);
        }
      }
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = lineWidth;
      this.ctx.beginPath();
      this.ctx.moveTo(exitPoint.x, exitPoint.y);
      const control1X = exitPoint.x - controlOffset;
      const control1Y = exitPoint.y;
      const control2X = entryPoint.x - controlOffset;
      const control2Y = entryPoint.y;
      this.ctx.bezierCurveTo(control1X, control1Y, control2X, control2Y, entryPoint.x, entryPoint.y);
      this.ctx.stroke();
      this.ctx.fillStyle = strokeColor;
      const tangentX = 3 * (entryPoint.x - control2X);
      const tangentY = 3 * (entryPoint.y - control2Y);
      const angle = Math.atan2(tangentY, tangentX);
      this.drawArrow(entryPoint.x, entryPoint.y, angle, 5);
    });
  }
  async renderNodes(state) {
    for (const nodeName of state.nodes) {
      const pos = this.nodePositions.get(nodeName);
      if (!pos)
        continue;
      const isSelected = this.selectedNodes.includes(nodeName);
      const isCompleted = this.completedNodes.has(nodeName);
      let nodeColor = this.getColor(theme.colors.nodeBackground);
      if (isCompleted) {
        nodeColor = "hsl(120, 60%, 50%)";
      } else if (isSelected) {
        nodeColor = this.getColor(theme.colors.nodeSelected);
      }
      this.ctx.fillStyle = nodeColor;
      this.ctx.strokeStyle = this.getColor(theme.colors.nodeBorder);
      this.ctx.lineWidth = theme.sizes.nodeBorderWidth;
      this.ctx.beginPath();
      this.ctx.arc(pos.x, pos.y, theme.nodeRadius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
      await this.renderIcon(nodeName, pos.x, pos.y, theme.nodeRadius);
    }
  }
  getNodeAt(x, y) {
    for (const [nodeName, pos] of this.nodePositions) {
      const dist = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
      if (dist <= theme.nodeRadius) {
        return nodeName;
      }
    }
    return null;
  }
  addIcon(name, pathData) {
    LUCIDE_ICONS[name] = { path: pathData, viewBox: "0 0 24 24" };
    const path2D = new Path2D(pathData);
    this.iconPaths.set(name, path2D);
  }
}

// src/components/DagViewer/Controller.ts
class DAGController {
  canvas;
  engine;
  renderer;
  getNodeType;
  getNodeDescription;
  connectionMode = false;
  selectedNodes = [];
  hoveredNode = null;
  completedNodes = new Set;
  constructor(canvas, getNodeType2, getNodeDescription) {
    this.canvas = canvas;
    this.engine = new DAGEngine;
    this.renderer = new DAGRenderer(this.canvas, getNodeType2, this.completedNodes);
    this.getNodeType = getNodeType2;
    this.getNodeDescription = getNodeDescription;
    this.setupEventListeners();
  }
  setupEventListeners() {
    this.engine.on("change", (nodes, edges) => {
      this.renderer.render({
        nodes,
        edges,
        completedNodes: this.completedNodes
      }, this.hoveredNode, this.selectedNodes);
    });
    this.canvas.addEventListener("click", (e) => this.handleClick(e));
    this.canvas.addEventListener("mousemove", (e) => this.handleMouseMove(e));
    this.canvas.addEventListener("mouseleave", () => this.handleMouseLeave());
  }
  handleClick(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (this.connectionMode) {
      const nodeName = this.renderer.getNodeAt(x, y);
      if (nodeName) {
        this.selectedNodes.push(nodeName);
        if (this.selectedNodes.length === 2) {
          const success = this.engine.addEdge(this.selectedNodes[0], this.selectedNodes[1]);
          const debugInfo = document.getElementById("debugInfo");
          if (debugInfo && !success) {
            debugInfo.textContent = `Ошибка: не удалось создать связь ${this.selectedNodes[0]} -> ${this.selectedNodes[1]}`;
          }
          this.selectedNodes = [];
        }
        const nodes = this.engine.getNodes();
        const edges = this.engine.getEdges();
        this.renderer.render({
          nodes,
          edges,
          completedNodes: this.completedNodes
        }, this.hoveredNode, this.selectedNodes);
      }
    }
  }
  async handleMouseMove(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const nodeName = this.renderer.getNodeAt(x, y);
    if (nodeName !== this.hoveredNode) {
      this.hoveredNode = nodeName;
      const nodes = this.engine.getNodes();
      const edges = this.engine.getEdges();
      this.renderer.render({
        nodes,
        edges,
        completedNodes: this.completedNodes
      }, this.hoveredNode, this.selectedNodes);
      const debugInfo = document.getElementById("debugInfo");
      if (debugInfo && nodeName) {
        try {
          const nodeType = await this.getNodeType(nodeName);
          debugInfo.textContent = `Наведение на узел: ${nodeName} (тип: ${nodeType})`;
        } catch (error) {
          debugInfo.textContent = `Наведение на узел: ${nodeName} (ошибка загрузки типа)`;
        }
      }
    }
  }
  handleMouseLeave() {
    if (this.hoveredNode !== null) {
      this.hoveredNode = null;
      const nodes = this.engine.getNodes();
      const edges = this.engine.getEdges();
      this.renderer.render({
        nodes,
        edges,
        completedNodes: this.completedNodes
      }, this.hoveredNode, this.selectedNodes);
    }
  }
  async initFromMap(nodeMap) {
    this.clearAll();
    for (const nodeName of nodeMap.keys()) {
      this.engine.addNode(nodeName);
    }
    for (const [fromNode, connections] of nodeMap.entries()) {
      const targets = Array.isArray(connections) ? connections : [connections];
      for (const toNode of targets) {
        if (nodeMap.has(toNode)) {
          this.engine.addEdge(fromNode, toNode);
        }
      }
    }
  }
  markNodeCompleted(nodeName) {
    this.completedNodes.add(nodeName);
    const nodes = this.engine.getNodes();
    const edges = this.engine.getEdges();
    this.renderer.render({
      nodes,
      edges,
      completedNodes: this.completedNodes
    }, this.hoveredNode, this.selectedNodes);
  }
  markNodeIncomplete(nodeName) {
    this.completedNodes.delete(nodeName);
    const nodes = this.engine.getNodes();
    const edges = this.engine.getEdges();
    this.renderer.render({
      nodes,
      edges,
      completedNodes: this.completedNodes
    }, this.hoveredNode, this.selectedNodes);
  }
  getCompletedNodes() {
    return new Set(this.completedNodes);
  }
  async getNodeDescriptions() {
    const descriptions = new Map;
    const nodes = this.engine.getNodes();
    for (const nodeName of nodes) {
      try {
        const description = await this.getNodeDescription(nodeName);
        descriptions.set(nodeName, description);
      } catch (error) {
        descriptions.set(nodeName, "Ошибка загрузки описания");
      }
    }
    return descriptions;
  }
  addNode(name) {
    return this.engine.addNode(name);
  }
  removeNode(name) {
    this.selectedNodes = this.selectedNodes.filter((node) => node !== name);
    if (this.hoveredNode === name) {
      this.hoveredNode = null;
    }
    this.completedNodes.delete(name);
    return this.engine.removeNode(name);
  }
  addEdge(from, to) {
    return this.engine.addEdge(from, to);
  }
  removeEdge(from, to) {
    return this.engine.removeEdge(from, to);
  }
  clearAll() {
    this.engine.clear();
    this.selectedNodes = [];
    this.hoveredNode = null;
    this.completedNodes.clear();
  }
  getNodes() {
    return this.engine.getNodes();
  }
  getEdges() {
    return this.engine.getEdges();
  }
  getNodeConnections(name) {
    return this.engine.getNodeConnections(name);
  }
  hasNode(name) {
    return this.engine.hasNode(name);
  }
  hasEdge(from, to) {
    return this.engine.hasEdge(from, to);
  }
  toggleConnectionMode() {
    this.connectionMode = !this.connectionMode;
    this.selectedNodes = [];
    const btn = document.getElementById("connectionBtn");
    if (btn) {
      btn.textContent = `Режим соединения: ${this.connectionMode ? "ВКЛ" : "ВЫКЛ"}`;
      btn.className = this.connectionMode ? "active" : "";
    }
    this.canvas.style.cursor = this.connectionMode ? "crosshair" : "pointer";
    const nodes = this.engine.getNodes();
    const edges = this.engine.getEdges();
    this.renderer.render({
      nodes,
      edges,
      completedNodes: this.completedNodes
    }, this.hoveredNode, this.selectedNodes);
  }
  isConnectionMode() {
    return this.connectionMode;
  }
  getSelectedNodes() {
    return [...this.selectedNodes];
  }
  getHoveredNode() {
    return this.hoveredNode;
  }
  hasCycle() {
    return this.engine.hasCycle();
  }
  topologicalSort() {
    return this.engine.topologicalSort();
  }
}

// src/components/DagViewer/index.tsx
import { jsxDEV } from "react/jsx-dev-runtime";
function DagViewer({
  nodeMap,
  getNodeType: getNodeType2,
  getNodeDescription,
  completedNodes = new Set,
  onclick
}) {
  const canvasRef = useRef(null);
  const [descriptions, setDescriptions] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [controller, setController] = useState(null);
  const stableCompletedNodes = useMemo(() => {
    return Array.from(completedNodes).sort().join(",");
  }, [completedNodes]);
  const stableNodeMap = useMemo(() => {
    const entries = Array.from(nodeMap.entries()).sort();
    return JSON.stringify(entries);
  }, [nodeMap]);
  useEffect(() => {
    if (!canvasRef.current)
      return;
    let isCancelled = false;
    const initController = async () => {
      try {
        const newController = new DAGController(canvasRef.current, getNodeType2, getNodeDescription);
        await newController.initFromMap(nodeMap);
        if (isCancelled)
          return;
        for (const nodeName of completedNodes) {
          newController.markNodeCompleted(nodeName);
        }
        const nodeList = newController.getNodes();
        if (isCancelled)
          return;
        setNodes(nodeList);
        try {
          const nodeDescriptions = await Promise.all(nodeList.map(async (nodeName) => {
            try {
              return await getNodeDescription(nodeName);
            } catch (error) {
              console.warn(`Ошибка загрузки описания для ${nodeName}:`, error);
              return "Ошибка загрузки описания";
            }
          }));
          if (isCancelled)
            return;
          setDescriptions(nodeDescriptions);
        } catch (error) {
          console.error("Ошибка загрузки описаний:", error);
          if (!isCancelled) {
            setDescriptions(nodeList.map(() => "Ошибка загрузки описания"));
          }
        }
        if (isCancelled)
          return;
        const edges = newController.getEdges();
        const renderState = {
          nodes: nodeList,
          edges,
          completedNodes
        };
        newController.renderer.render(renderState, null, []);
        setController(newController);
      } catch (error) {
        console.error("Ошибка инициализации контроллера:", error);
      }
    };
    initController();
    return () => {
      isCancelled = true;
    };
  }, [stableNodeMap, stableCompletedNodes, getNodeType2, getNodeDescription]);
  return /* @__PURE__ */ jsxDEV("div", {
    className: "flex w-full h-full min-h-0",
    children: [
      /* @__PURE__ */ jsxDEV("canvas", {
        ref: canvasRef,
        width: 80,
        height: 600,
        className: "border flex-none",
        style: {
          width: "80px",
          height: "600px"
        }
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV("div", {
        className: "ml-4 flex-1 min-w-0 overflow-y-auto",
        children: nodes.map((nodeName, i) => {
          const description = descriptions[i] || "Загрузка...";
          const isCompleted = completedNodes.has(nodeName);
          return /* @__PURE__ */ jsxDEV("div", {
            className: `text-sm border-l-2 pl-2 cursor-pointer transition-colors duration-200 hover:bg-accent hover:text-accent-foreground min-w-0 ${isCompleted ? "border-green-500" : "border-gray-300"}`,
            style: { height: "40px" },
            onClick: () => onclick?.(nodeName),
            children: [
              /* @__PURE__ */ jsxDEV("div", {
                className: "font-medium text-xs truncate",
                title: nodeName,
                children: nodeName
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV("div", {
                className: "text-xs text-muted-foreground leading-tight truncate",
                title: description,
                children: description
              }, undefined, false, undefined, this)
            ]
          }, `${nodeName}-${i}`, true, undefined, this);
        })
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}

// src/views/DagView.tsx
import { jsxDEV as jsxDEV2 } from "react/jsx-dev-runtime";
var loadWorkflow = domain_default.createEvent();
var getNodeDescription = domain_default.createEvent();
var nodeClicked = domain_default.createEvent();
var loadWorkflowFx = domain_default.createEffect(async (workflowId) => {
  const versions = await (await service_default.getWorkflowVersions(workflowId)).versions;
  const config = await service_default.getWorkflowConfigByName(workflowId, versions[versions.length - 1]);
  return createNodeMap(config);
});
var getNodeDescriptionFx = domain_default.createEffect(async (nodeName) => {
  return (await service_default.getNode(nodeName)).config.codeVersion;
});
var $nodeMap = domain_default.createStore(null);
var $loading = domain_default.createStore(false);
var $nodeDescriptions = domain_default.createStore({});
sample2({ clock: loadWorkflow, target: loadWorkflowFx });
sample2({ clock: loadWorkflowFx.doneData, target: $nodeMap });
sample2({ clock: loadWorkflowFx.pending, target: $loading });
sample2({ clock: getNodeDescription, target: getNodeDescriptionFx });
sample2({
  clock: getNodeDescriptionFx.doneData,
  source: $nodeDescriptions,
  fn: (descriptions, { params, result }) => ({
    ...descriptions,
    [params]: result
  }),
  target: $nodeDescriptions
});
var DagContainer = ({
  id,
  onNodeEvent
}) => {
  const nodeMap = useStore($nodeMap);
  const loading = useStore($loading);
  const nodeDescriptions = useStore($nodeDescriptions);
  useEffect2(() => {
    loadWorkflow(id);
  }, [id]);
  const handleGetNodeDescription = async (nodeName) => {
    if (customGetNodeDescription) {
      return await customGetNodeDescription(nodeName);
    }
    if (nodeDescriptions[nodeName]) {
      return nodeDescriptions[nodeName];
    }
    getNodeDescription(nodeName);
    return new Promise((resolve) => {
      const unsubscribe = $nodeDescriptions.watch((descriptions) => {
        if (descriptions[nodeName]) {
          unsubscribe();
          resolve(descriptions[nodeName]);
        }
      });
    });
  };
  const handleNodeClick = (nodeName) => {
    if (onNodeClick) {
      onNodeClick(nodeName);
    } else {
      nodeClicked(nodeName);
    }
  };
  if (loading)
    return /* @__PURE__ */ jsxDEV2("div", {
      children: "Loading..."
    }, undefined, false, undefined, this);
  if (!nodeMap)
    return /* @__PURE__ */ jsxDEV2("div", {
      children: "No data"
    }, undefined, false, undefined, this);
  return /* @__PURE__ */ jsxDEV2(DagViewer, {
    nodeMap,
    getNodeDescription: handleGetNodeDescription,
    getNodeType,
    onNodeClick: handleNodeClick
  }, undefined, false, undefined, this);
};
var DagView_default = DagContainer;

// src/views/WorkflowsListView.tsx
import { useEffect as useEffect3 } from "react";
import { useUnit } from "effector-react";
import { HeaderPanel, InfiniteScrollDataTable } from "front-core";

// ../../../../node_modules/.bun/lucide-react@0.553.0+b1ab299f0a400331/node_modules/lucide-react/dist/esm/createLucideIcon.js
import { forwardRef as forwardRef2, createElement as createElement2 } from "react";

// ../../../../node_modules/.bun/lucide-react@0.553.0+b1ab299f0a400331/node_modules/lucide-react/dist/esm/shared/src/utils.js
var toKebabCase = (string) => string.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
var toCamelCase = (string) => string.replace(/^([A-Z])|[\s-_]+(\w)/g, (match, p1, p2) => p2 ? p2.toUpperCase() : p1.toLowerCase());
var toPascalCase = (string) => {
  const camelCase = toCamelCase(string);
  return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
};
var mergeClasses = (...classes) => classes.filter((className, index, array) => {
  return Boolean(className) && className.trim() !== "" && array.indexOf(className) === index;
}).join(" ").trim();
var hasA11yProp = (props) => {
  for (const prop in props) {
    if (prop.startsWith("aria-") || prop === "role" || prop === "title") {
      return true;
    }
  }
};

// ../../../../node_modules/.bun/lucide-react@0.553.0+b1ab299f0a400331/node_modules/lucide-react/dist/esm/Icon.js
import { forwardRef, createElement } from "react";

// ../../../../node_modules/.bun/lucide-react@0.553.0+b1ab299f0a400331/node_modules/lucide-react/dist/esm/defaultAttributes.js
var defaultAttributes = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round"
};

// ../../../../node_modules/.bun/lucide-react@0.553.0+b1ab299f0a400331/node_modules/lucide-react/dist/esm/Icon.js
var Icon = forwardRef(({
  color = "currentColor",
  size = 24,
  strokeWidth = 2,
  absoluteStrokeWidth,
  className = "",
  children,
  iconNode,
  ...rest
}, ref) => createElement("svg", {
  ref,
  ...defaultAttributes,
  width: size,
  height: size,
  stroke: color,
  strokeWidth: absoluteStrokeWidth ? Number(strokeWidth) * 24 / Number(size) : strokeWidth,
  className: mergeClasses("lucide", className),
  ...!children && !hasA11yProp(rest) && { "aria-hidden": "true" },
  ...rest
}, [
  ...iconNode.map(([tag, attrs]) => createElement(tag, attrs)),
  ...Array.isArray(children) ? children : [children]
]));

// ../../../../node_modules/.bun/lucide-react@0.553.0+b1ab299f0a400331/node_modules/lucide-react/dist/esm/createLucideIcon.js
var createLucideIcon = (iconName, iconNode) => {
  const Component = forwardRef2(({ className, ...props }, ref) => createElement2(Icon, {
    ref,
    iconNode,
    className: mergeClasses(`lucide-${toKebabCase(toPascalCase(iconName))}`, `lucide-${iconName}`, className),
    ...props
  }));
  Component.displayName = toPascalCase(iconName);
  return Component;
};

// ../../../../node_modules/.bun/lucide-react@0.553.0+b1ab299f0a400331/node_modules/lucide-react/dist/esm/icons/plus.js
var __iconNode = [
  ["path", { d: "M5 12h14", key: "1ays0h" }],
  ["path", { d: "M12 5v14", key: "s699le" }]
];
var Plus = createLucideIcon("plus", __iconNode);

// ../../../../node_modules/.bun/lucide-react@0.553.0+b1ab299f0a400331/node_modules/lucide-react/dist/esm/icons/refresh-cw.js
var __iconNode2 = [
  ["path", { d: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8", key: "v9h5vc" }],
  ["path", { d: "M21 3v5h-5", key: "1q7to0" }],
  ["path", { d: "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16", key: "3uifl3" }],
  ["path", { d: "M8 16H3v5", key: "1cv678" }]
];
var RefreshCw = createLucideIcon("refresh-cw", __iconNode2);

// ../../../../node_modules/.bun/lucide-react@0.553.0+b1ab299f0a400331/node_modules/lucide-react/dist/esm/icons/save.js
var __iconNode3 = [
  [
    "path",
    {
      d: "M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
      key: "1c8476"
    }
  ],
  ["path", { d: "M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7", key: "1ydtos" }],
  ["path", { d: "M7 3v4a1 1 0 0 0 1 1h7", key: "t51u73" }]
];
var Save = createLucideIcon("save", __iconNode3);

// ../../../../node_modules/.bun/lucide-react@0.553.0+b1ab299f0a400331/node_modules/lucide-react/dist/esm/icons/x.js
var __iconNode4 = [
  ["path", { d: "M18 6 6 18", key: "1bl5f8" }],
  ["path", { d: "m6 6 12 12", key: "d8bk6v" }]
];
var X = createLucideIcon("x", __iconNode4);
// src/domain-workflows.ts
import { createDomain as createDomain2, sample as sample3 } from "effector";
import { createInfiniteTableStore } from "front-core";
var domain2 = createDomain2("dag-workflows");
var workflowsViewMounted = domain2.createEvent("WORKFLOWS_VIEW_MOUNTED");
var refreshWorkflowsClicked = domain2.createEvent("REFRESH_WORKFLOWS_CLICKED");
var addWorkflowClicked = domain2.createEvent("ADD_WORKFLOW_CLICKED");
var openWorkflowForm = domain2.createEvent("OPEN_WORKFLOW_FORM");
var listWorkflowsFx = domain2.createEffect({
  name: "LIST_WORKFLOWS",
  handler: async () => {
    const result = await service_default.workflowList();
    const items = result.names.map((name) => ({
      name,
      description: "",
      nodesCount: 0
    }));
    return {
      items,
      totalCount: items.length
    };
  }
});
var $workflowsStore = createInfiniteTableStore(domain2, listWorkflowsFx);
var $currentWorkflow = domain2.createStore(null);
sample3({ clock: openWorkflowForm, fn: ({ workflow }) => workflow || null, target: $currentWorkflow });
sample3({
  clock: workflowsViewMounted,
  filter: () => {
    const state = $workflowsStore.$state.getState();
    return !state.isInitialized && !state.loading;
  },
  fn: () => ({}),
  target: $workflowsStore.loadMore
});
sample3({
  clock: refreshWorkflowsClicked,
  fn: () => ({}),
  target: $workflowsStore.reset
});
sample3({
  clock: refreshWorkflowsClicked,
  fn: () => ({}),
  target: $workflowsStore.loadMore
});

// src/functions/columns.ts
import { getTableColumns } from "front-core";
var workflowsColumns = getTableColumns(workflowsFields);
var nodesColumns = getTableColumns(nodesFields);
var providersColumns = getTableColumns(providersFields);

// src/views/WorkflowsListView.tsx
import { jsxDEV as jsxDEV3 } from "react/jsx-dev-runtime";
var WorkflowsListView = ({ bus }) => {
  const workflowsState = useUnit($workflowsStore.$state);
  useEffect3(() => {
    workflowsViewMounted();
    const unwatch = addWorkflowClicked.watch(() => {
      openWorkflowForm({ workflow: null });
      bus.present({ widget: createWorkflowFormWidget(bus) });
    });
    return () => unwatch();
  }, [bus]);
  const headerConfig = {
    title: "Workflows",
    actions: [
      {
        id: "add",
        label: "Add Workflow",
        icon: Plus,
        event: addWorkflowClicked,
        variant: "default"
      },
      {
        id: "refresh",
        label: "Refresh",
        icon: RefreshCw,
        event: refreshWorkflowsClicked,
        variant: "outline"
      }
    ]
  };
  const handleRowClick = (row) => {
    openWorkflowForm({ workflow: row });
    bus.present({ widget: createWorkflowFormWidget(bus) });
  };
  return /* @__PURE__ */ jsxDEV3("div", {
    className: "flex flex-col h-full",
    children: [
      /* @__PURE__ */ jsxDEV3(HeaderPanel, {
        config: headerConfig
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV3("div", {
        className: "flex-1 overflow-hidden p-4",
        children: /* @__PURE__ */ jsxDEV3(InfiniteScrollDataTable, {
          data: workflowsState.items,
          hasMore: workflowsState.hasMore,
          loading: workflowsState.loading,
          columns: workflowsColumns,
          onLoadMore: $workflowsStore.loadMore,
          onRowClick: handleRowClick,
          viewMode: "table"
        }, undefined, false, undefined, this)
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
};

// src/functions/wokflow.ts
var SHOW_WORKFLOWS_LIST = "workflows.show";
var SHOW_WORKFLOW_FORM = "workflow_form.show";
var SHOW_WORKFLOW = "workflow.show";
var SHOW_WORKFLOWS_STATISTIC = "workflows.statistic.show";
var $workflowsStatStore = domain_default.createStore(0);
var getWorkflowsStatEvent = domain_default.createEvent("GET_WORKFLOWS_STAT");
var getWorkflowsStatFx = domain_default.createEffect({
  name: "WORKFLOWS_STAT",
  handler: () => service_default.workflowList()
});
sample4({
  clock: getWorkflowsStatEvent,
  target: getWorkflowsStatFx
});
sample4({
  clock: getWorkflowsStatFx.doneData,
  fn: (data) => data.names?.length || 0,
  target: $workflowsStatStore
});
var workflowFormFields = getAllFormFields(workflowsFields);
var createWorkflowFormWidget = () => ({
  view: BasicFormView,
  placement: () => "sidebar:tab:dag",
  config: {
    fields: workflowFormFields,
    entityStore: $currentWorkflow,
    title: "Workflow Configuration",
    subtitle: "Configure workflow parameters"
  },
  commands: {
    onSave: async (data) => {
      console.log("Save workflow:", data);
    },
    onCancel: () => {
      openWorkflowForm({ workflow: null });
    }
  }
});
var createWorkflowsDetailWidget = () => ({
  view: DagView_default,
  placement: () => "right",
  commands: {
    onNodeEvent: (nodeName, eventType) => {
      console.log("onclick", nodeName, eventType);
    }
  }
});
var createWorkflowsStatisticWidget = () => ({
  view: StatCard,
  config: {
    $value: $workflowsStatStore,
    title: "Workflows Count"
  },
  placement: () => "float",
  commands: {
    refresh: () => getWorkflowsStatEvent()
  }
});
var createWorkflowsListWidget = (bus) => ({
  view: WorkflowsListView,
  placement: () => "center",
  config: {
    bus
  }
});
var createShowWorkflowsListAction = (bus) => ({
  id: SHOW_WORKFLOWS_LIST,
  description: "Show workflows list",
  invoke: () => {
    bus.present({ widget: createWorkflowsListWidget(bus) });
  }
});
var createShowWorkflowFormAction = (bus) => ({
  id: SHOW_WORKFLOW_FORM,
  description: "Show workflow form",
  invoke: ({ workflow }) => {
    openWorkflowForm({ workflow });
    bus.present({ widget: createWorkflowFormWidget(bus) });
  }
});
var createShowWorkflowDetailAction = (bus) => ({
  id: SHOW_WORKFLOW,
  description: "Show workflow detail",
  invoke: () => {
    bus.present({ widget: createWorkflowsDetailWidget(bus) });
  }
});
var createShowWorkflowsStatisticAction = (bus) => ({
  id: SHOW_WORKFLOWS_STATISTIC,
  description: "Show workflows statistic",
  invoke: () => {
    getWorkflowsStatEvent();
    bus.present({ widget: createWorkflowsStatisticWidget(bus) });
  }
});
var ACTIONS = [
  createShowWorkflowsListAction,
  createShowWorkflowFormAction,
  createShowWorkflowDetailAction,
  createShowWorkflowsStatisticAction
];
var wokflow_default = ACTIONS;

// src/views/NodesListView.tsx
import { useEffect as useEffect4 } from "react";
import { useUnit as useUnit2 } from "effector-react";
import { HeaderPanel as HeaderPanel2, InfiniteScrollDataTable as InfiniteScrollDataTable2 } from "front-core";

// src/domain-nodes.ts
import { createDomain as createDomain3, sample as sample5 } from "effector";
import { createInfiniteTableStore as createInfiniteTableStore2 } from "front-core";
var domain3 = createDomain3("dag-nodes");
var nodesViewMounted = domain3.createEvent("NODES_VIEW_MOUNTED");
var refreshNodesClicked = domain3.createEvent("REFRESH_NODES_CLICKED");
var addNodeClicked = domain3.createEvent("ADD_NODE_CLICKED");
var openNodeForm = domain3.createEvent("OPEN_NODE_FORM");
var listNodesFx = domain3.createEffect({
  name: "LIST_NODES",
  handler: async (params) => {
    const result = await service_default.nodeList();
    const items = result.names.map((name) => ({
      name,
      codeSource: ""
    }));
    return {
      items,
      totalCount: items.length
    };
  }
});
var createNodeFx = domain3.createEffect({
  name: "CREATE_NODE",
  handler: async (data) => {
    const result = await service_default.createNode(data.name, data.nodeConfigHash);
    return result;
  }
});
var $nodesStore = createInfiniteTableStore2(domain3, listNodesFx);
var $currentNode = domain3.createStore(null);
sample5({ clock: openNodeForm, fn: ({ node }) => node || null, target: $currentNode });
sample5({ clock: createNodeFx.done, fn: () => null, target: $currentNode });
sample5({
  clock: createNodeFx.done,
  fn: () => ({}),
  target: $nodesStore.reset
});
sample5({
  clock: createNodeFx.done,
  fn: () => ({}),
  target: $nodesStore.loadMore
});
sample5({
  clock: nodesViewMounted,
  filter: () => {
    const state = $nodesStore.$state.getState();
    return !state.isInitialized && !state.loading;
  },
  fn: () => ({}),
  target: $nodesStore.loadMore
});
sample5({
  clock: refreshNodesClicked,
  fn: () => ({}),
  target: $nodesStore.reset
});
sample5({
  clock: refreshNodesClicked,
  fn: () => ({}),
  target: $nodesStore.loadMore
});

// src/views/NodesListView.tsx
import { jsxDEV as jsxDEV4 } from "react/jsx-dev-runtime";
var NodesListView = ({ bus }) => {
  const nodesState = useUnit2($nodesStore.$state);
  useEffect4(() => {
    nodesViewMounted();
    const unwatch = addNodeClicked.watch(() => {
      openNodeForm({ node: null });
      bus.present({ widget: createNodeFormWidget(bus) });
    });
    return () => unwatch();
  }, [bus]);
  const headerConfig = {
    title: "Nodes",
    actions: [
      {
        id: "add",
        label: "Add Node",
        icon: Plus,
        event: addNodeClicked,
        variant: "default"
      },
      {
        id: "refresh",
        label: "Refresh",
        icon: RefreshCw,
        event: refreshNodesClicked,
        variant: "outline"
      }
    ]
  };
  const handleRowClick = (row) => {
    openNodeForm({ node: row });
    bus.present({ widget: createNodeFormWidget(bus) });
  };
  return /* @__PURE__ */ jsxDEV4("div", {
    className: "flex flex-col h-full",
    children: [
      /* @__PURE__ */ jsxDEV4(HeaderPanel2, {
        config: headerConfig
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV4("div", {
        className: "flex-1 overflow-hidden p-4",
        children: /* @__PURE__ */ jsxDEV4(InfiniteScrollDataTable2, {
          data: nodesState.items,
          hasMore: nodesState.hasMore,
          loading: nodesState.loading,
          columns: nodesColumns,
          onLoadMore: $nodesStore.loadMore,
          onRowClick: handleRowClick,
          viewMode: "table"
        }, undefined, false, undefined, this)
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
};

// src/views/NodeConfigForm.tsx
import { useEffect as useEffect5 } from "react";
import { sample as sample6 } from "effector";
import { useUnit as useUnit3 } from "effector-react";
import {
  Button,
  Input,
  Label,
  Textarea,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "front-core";
import { jsxDEV as jsxDEV5 } from "react/jsx-dev-runtime";
var formMounted = domain_default.createEvent();
var codeSourceSelected = domain_default.createEvent();
var nameChanged = domain_default.createEvent();
var configFieldChanged = domain_default.createEvent();
var saveClicked = domain_default.createEvent();
var cancelClicked = domain_default.createEvent();
var formReset = domain_default.createEvent();
var fetchSchemaFx = domain_default.createEffect({
  handler: async (codeSourceName) => {
    const result = await service_default.getCodeSourceVersions(codeSourceName);
    const versions = result.versions || [];
    if (versions.length === 0)
      return [];
    return versions[0].fields || [];
  }
});
var createNodeFx2 = domain_default.createEffect({
  handler: async (data) => {
    const configResult = await service_default.createNodeConfig(data.codeSource, data.config);
    const nodeResult = await service_default.createNode(data.name, configResult.hash);
    return nodeResult;
  }
});
var $name = domain_default.createStore("").on(nameChanged, (_, name) => name).reset(formReset);
var $selectedCodeSource = domain_default.createStore("").on(codeSourceSelected, (_, cs) => cs).reset(formReset);
var $schemaFields = domain_default.createStore([]).on(fetchSchemaFx.doneData, (_, fields) => fields).reset(formReset);
var $configValues = domain_default.createStore({}).on(configFieldChanged, (state, { field, value }) => ({ ...state, [field]: value })).reset(formReset).reset(codeSourceSelected);
var $loading2 = domain_default.createStore(false).on(fetchSchemaFx.pending, (_, pending) => pending).on(createNodeFx2.pending, (_, pending) => pending);
var $saving = createNodeFx2.pending;
sample6({
  clock: codeSourceSelected,
  filter: (cs) => cs !== "",
  target: fetchSchemaFx
});
sample6({
  clock: formMounted,
  target: loadCodeSourcesFx
});
sample6({
  clock: saveClicked,
  source: { name: $name, codeSource: $selectedCodeSource, config: $configValues },
  filter: ({ name, codeSource }) => name !== "" && codeSource !== "",
  target: createNodeFx2
});
sample6({
  clock: createNodeFx2.done,
  target: formReset
});
var NodeConfigForm = ({ onSave, onCancel }) => {
  const [
    name,
    selectedCodeSource,
    codeSources,
    schemaFields,
    configValues,
    loading,
    saving
  ] = useUnit3([
    $name,
    $selectedCodeSource,
    $codeSources,
    $schemaFields,
    $configValues,
    $loading2,
    $saving
  ]);
  useEffect5(() => {
    formMounted();
  }, []);
  useEffect5(() => {
    const unsub = createNodeFx2.done.watch(() => {
      onSave?.();
    });
    return unsub;
  }, [onSave]);
  const handleCancel = () => {
    formReset();
    onCancel?.();
  };
  const renderField = (field) => {
    const value = configValues[field.name] || "";
    const isTextArea = field.type === "string" && (field.name.toLowerCase().includes("query") || field.name.toLowerCase().includes("template") || field.name.toLowerCase().includes("body"));
    return /* @__PURE__ */ jsxDEV5("div", {
      className: "space-y-2",
      children: [
        /* @__PURE__ */ jsxDEV5(Label, {
          children: field.name
        }, undefined, false, undefined, this),
        isTextArea ? /* @__PURE__ */ jsxDEV5(Textarea, {
          value,
          onChange: (e) => configFieldChanged({ field: field.name, value: e.target.value }),
          placeholder: `Enter ${field.name}...`,
          rows: 3
        }, undefined, false, undefined, this) : field.type === "number" ? /* @__PURE__ */ jsxDEV5(Input, {
          type: "number",
          value,
          onChange: (e) => configFieldChanged({ field: field.name, value: Number(e.target.value) }),
          placeholder: `Enter ${field.name}...`
        }, undefined, false, undefined, this) : field.type === "boolean" ? /* @__PURE__ */ jsxDEV5(Select, {
          value: String(value || false),
          onValueChange: (v) => configFieldChanged({ field: field.name, value: v === "true" }),
          children: [
            /* @__PURE__ */ jsxDEV5(SelectTrigger, {
              children: /* @__PURE__ */ jsxDEV5(SelectValue, {}, undefined, false, undefined, this)
            }, undefined, false, undefined, this),
            /* @__PURE__ */ jsxDEV5(SelectContent, {
              children: [
                /* @__PURE__ */ jsxDEV5(SelectItem, {
                  value: "true",
                  children: "Yes"
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV5(SelectItem, {
                  value: "false",
                  children: "No"
                }, undefined, false, undefined, this)
              ]
            }, undefined, true, undefined, this)
          ]
        }, undefined, true, undefined, this) : /* @__PURE__ */ jsxDEV5(Input, {
          value,
          onChange: (e) => configFieldChanged({ field: field.name, value: e.target.value }),
          placeholder: `Enter ${field.name}...`
        }, undefined, false, undefined, this)
      ]
    }, field.name, true, undefined, this);
  };
  return /* @__PURE__ */ jsxDEV5("div", {
    className: "p-4 space-y-4",
    children: [
      /* @__PURE__ */ jsxDEV5("div", {
        className: "flex justify-between items-center",
        children: /* @__PURE__ */ jsxDEV5("h2", {
          className: "text-lg font-semibold",
          children: "Create Node"
        }, undefined, false, undefined, this)
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV5(Card, {
        children: [
          /* @__PURE__ */ jsxDEV5(CardHeader, {
            children: /* @__PURE__ */ jsxDEV5(CardTitle, {
              children: "Basic Information"
            }, undefined, false, undefined, this)
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV5(CardContent, {
            className: "space-y-4",
            children: [
              /* @__PURE__ */ jsxDEV5("div", {
                className: "space-y-2",
                children: [
                  /* @__PURE__ */ jsxDEV5(Label, {
                    children: "Name *"
                  }, undefined, false, undefined, this),
                  /* @__PURE__ */ jsxDEV5(Input, {
                    value: name,
                    onChange: (e) => nameChanged(e.target.value),
                    placeholder: "Enter node name..."
                  }, undefined, false, undefined, this)
                ]
              }, undefined, true, undefined, this),
              /* @__PURE__ */ jsxDEV5("div", {
                className: "space-y-2",
                children: [
                  /* @__PURE__ */ jsxDEV5(Label, {
                    children: "Code Source *"
                  }, undefined, false, undefined, this),
                  /* @__PURE__ */ jsxDEV5(Select, {
                    value: selectedCodeSource,
                    onValueChange: codeSourceSelected,
                    children: [
                      /* @__PURE__ */ jsxDEV5(SelectTrigger, {
                        children: /* @__PURE__ */ jsxDEV5(SelectValue, {
                          placeholder: "Select code source..."
                        }, undefined, false, undefined, this)
                      }, undefined, false, undefined, this),
                      /* @__PURE__ */ jsxDEV5(SelectContent, {
                        children: codeSources.map((cs) => /* @__PURE__ */ jsxDEV5(SelectItem, {
                          value: cs,
                          children: cs
                        }, cs, false, undefined, this))
                      }, undefined, false, undefined, this)
                    ]
                  }, undefined, true, undefined, this)
                ]
              }, undefined, true, undefined, this)
            ]
          }, undefined, true, undefined, this)
        ]
      }, undefined, true, undefined, this),
      selectedCodeSource && /* @__PURE__ */ jsxDEV5(Card, {
        children: [
          /* @__PURE__ */ jsxDEV5(CardHeader, {
            children: [
              /* @__PURE__ */ jsxDEV5(CardTitle, {
                children: "Parameters"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV5(CardDescription, {
                children: [
                  "Configure node parameters for ",
                  selectedCodeSource
                ]
              }, undefined, true, undefined, this)
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV5(CardContent, {
            className: "space-y-4",
            children: loading ? /* @__PURE__ */ jsxDEV5("div", {
              className: "text-center py-4",
              children: "Loading parameters..."
            }, undefined, false, undefined, this) : schemaFields.length > 0 ? schemaFields.map(renderField) : /* @__PURE__ */ jsxDEV5("div", {
              className: "text-muted-foreground text-center py-4",
              children: "No parameters required"
            }, undefined, false, undefined, this)
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV5("div", {
        className: "flex gap-2 justify-end",
        children: [
          /* @__PURE__ */ jsxDEV5(Button, {
            variant: "outline",
            onClick: handleCancel,
            children: [
              /* @__PURE__ */ jsxDEV5(X, {
                className: "w-4 h-4 mr-2"
              }, undefined, false, undefined, this),
              "Cancel"
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV5(Button, {
            onClick: () => saveClicked(),
            disabled: !name || !selectedCodeSource || saving,
            children: [
              /* @__PURE__ */ jsxDEV5(Save, {
                className: "w-4 h-4 mr-2"
              }, undefined, false, undefined, this),
              saving ? "Saving..." : "Save"
            ]
          }, undefined, true, undefined, this)
        ]
      }, undefined, true, undefined, this)
    ]
  }, undefined, true, undefined, this);
};

// src/functions/node.config.ts
var SHOW_NODES_LIST = "nodes.show";
var SHOW_NODE_FORM = "node_form.show";
var createNodeFormWidget = (bus) => ({
  view: NodeConfigForm,
  placement: () => "sidebar:tab:dag",
  config: {},
  commands: {
    onSave: () => {
      bus.run(SHOW_NODES_LIST, {});
    },
    onCancel: () => {
      formReset();
    }
  }
});
var createNodesListWidget = (bus) => ({
  view: NodesListView,
  placement: () => "center",
  config: {
    bus
  }
});
var createShowNodesListAction = (bus) => ({
  id: SHOW_NODES_LIST,
  description: "Show nodes list",
  invoke: () => {
    bus.present({ widget: createNodesListWidget(bus) });
  }
});
var createShowNodeFormAction = (bus) => ({
  id: SHOW_NODE_FORM,
  description: "Show node form",
  invoke: () => {
    bus.present({ widget: createNodeFormWidget(bus) });
  }
});
var ACTIONS2 = [
  createShowNodesListAction,
  createShowNodeFormAction
];
var node_config_default = ACTIONS2;

// src/views/ProvidersListView.tsx
import { useEffect as useEffect6 } from "react";
import { useUnit as useUnit4 } from "effector-react";
import { HeaderPanel as HeaderPanel3, InfiniteScrollDataTable as InfiniteScrollDataTable3 } from "front-core";

// src/domain-providers.ts
import { createDomain as createDomain4, sample as sample7 } from "effector";
import { createInfiniteTableStore as createInfiniteTableStore3 } from "front-core";
var domain4 = createDomain4("dag-providers");
var providersViewMounted = domain4.createEvent("PROVIDERS_VIEW_MOUNTED");
var refreshProvidersClicked = domain4.createEvent("REFRESH_PROVIDERS_CLICKED");
var addProviderClicked = domain4.createEvent("ADD_PROVIDER_CLICKED");
var openProviderForm = domain4.createEvent("OPEN_PROVIDER_FORM");
var listProvidersFx = domain4.createEffect({
  name: "LIST_PROVIDERS",
  handler: async (params) => {
    const result = await service_default.providerList();
    const items = result.names.map((name) => ({
      name,
      codeSource: ""
    }));
    return {
      items,
      totalCount: items.length
    };
  }
});
var createProviderFx = domain4.createEffect({
  name: "CREATE_PROVIDER",
  handler: async (data) => {
    const result = await service_default.createProvider(data.name, data.codeSource, data.config || {});
    return result;
  }
});
var $providersStore = createInfiniteTableStore3(domain4, listProvidersFx);
var $currentProvider = domain4.createStore(null);
sample7({ clock: openProviderForm, fn: ({ provider }) => provider || null, target: $currentProvider });
sample7({ clock: createProviderFx.done, fn: () => null, target: $currentProvider });
sample7({
  clock: createProviderFx.done,
  fn: () => ({}),
  target: $providersStore.reset
});
sample7({
  clock: createProviderFx.done,
  fn: () => ({}),
  target: $providersStore.loadMore
});
sample7({
  clock: providersViewMounted,
  filter: () => {
    const state = $providersStore.$state.getState();
    return !state.isInitialized && !state.loading;
  },
  fn: () => ({}),
  target: $providersStore.loadMore
});
sample7({
  clock: refreshProvidersClicked,
  fn: () => ({}),
  target: $providersStore.reset
});
sample7({
  clock: refreshProvidersClicked,
  fn: () => ({}),
  target: $providersStore.loadMore
});

// src/views/ProvidersListView.tsx
import { jsxDEV as jsxDEV6 } from "react/jsx-dev-runtime";
var ProvidersListView = ({ bus }) => {
  const providersState = useUnit4($providersStore.$state);
  useEffect6(() => {
    providersViewMounted();
    const unwatch = addProviderClicked.watch(() => {
      openProviderForm({ provider: null });
      bus.present({ widget: createProviderFormWidget(bus) });
    });
    return () => unwatch();
  }, [bus]);
  const headerConfig = {
    title: "Providers",
    actions: [
      {
        id: "add",
        label: "Add Provider",
        icon: Plus,
        event: addProviderClicked,
        variant: "default"
      },
      {
        id: "refresh",
        label: "Refresh",
        icon: RefreshCw,
        event: refreshProvidersClicked,
        variant: "outline"
      }
    ]
  };
  const handleRowClick = (row) => {
    openProviderForm({ provider: row });
    bus.present({ widget: createProviderFormWidget(bus) });
  };
  return /* @__PURE__ */ jsxDEV6("div", {
    className: "flex flex-col h-full",
    children: [
      /* @__PURE__ */ jsxDEV6(HeaderPanel3, {
        config: headerConfig
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV6("div", {
        className: "flex-1 overflow-hidden p-4",
        children: /* @__PURE__ */ jsxDEV6(InfiniteScrollDataTable3, {
          data: providersState.items,
          hasMore: providersState.hasMore,
          loading: providersState.loading,
          columns: providersColumns,
          onLoadMore: $providersStore.loadMore,
          onRowClick: handleRowClick,
          viewMode: "table"
        }, undefined, false, undefined, this)
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
};

// src/views/ProviderConfigForm.tsx
import { useEffect as useEffect7 } from "react";
import { sample as sample8 } from "effector";
import { useUnit as useUnit5 } from "effector-react";
import {
  Button as Button2,
  Input as Input2,
  Label as Label2,
  Textarea as Textarea2,
  Card as Card2,
  CardContent as CardContent2,
  CardDescription as CardDescription2,
  CardHeader as CardHeader2,
  CardTitle as CardTitle2,
  Select as Select2,
  SelectContent as SelectContent2,
  SelectItem as SelectItem2,
  SelectTrigger as SelectTrigger2,
  SelectValue as SelectValue2
} from "front-core";
import { jsxDEV as jsxDEV7 } from "react/jsx-dev-runtime";
var providerFormMounted = domain_default.createEvent();
var providerCodeSourceSelected = domain_default.createEvent();
var providerNameChanged = domain_default.createEvent();
var providerConfigFieldChanged = domain_default.createEvent();
var providerSaveClicked = domain_default.createEvent();
var providerCancelClicked = domain_default.createEvent();
var providerFormReset = domain_default.createEvent();
var fetchProviderSchemaFx = domain_default.createEffect({
  handler: async (codeSourceName) => {
    const result = await service_default.getCodeSourceVersions(codeSourceName);
    const versions = result.versions || [];
    if (versions.length === 0)
      return [];
    return versions[0].fields || [];
  }
});
var createProviderFx2 = domain_default.createEffect({
  handler: async (data) => {
    const result = await service_default.createProvider(data.name, data.codeSource, data.config);
    return result;
  }
});
var $providerName = domain_default.createStore("").on(providerNameChanged, (_, name) => name).reset(providerFormReset);
var $providerSelectedCodeSource = domain_default.createStore("").on(providerCodeSourceSelected, (_, cs) => cs).reset(providerFormReset);
var $providerSchemaFields = domain_default.createStore([]).on(fetchProviderSchemaFx.doneData, (_, fields) => fields).reset(providerFormReset);
var $providerConfigValues = domain_default.createStore({}).on(providerConfigFieldChanged, (state, { field, value }) => ({ ...state, [field]: value })).reset(providerFormReset).reset(providerCodeSourceSelected);
var $providerLoading = domain_default.createStore(false).on(fetchProviderSchemaFx.pending, (_, pending) => pending).on(createProviderFx2.pending, (_, pending) => pending);
var $providerSaving = createProviderFx2.pending;
sample8({
  clock: providerCodeSourceSelected,
  filter: (cs) => cs !== "",
  target: fetchProviderSchemaFx
});
sample8({
  clock: providerFormMounted,
  target: loadProviderCodeSourcesFx
});
sample8({
  clock: providerSaveClicked,
  source: { name: $providerName, codeSource: $providerSelectedCodeSource, config: $providerConfigValues },
  filter: ({ name, codeSource }) => name !== "" && codeSource !== "",
  target: createProviderFx2
});
sample8({
  clock: createProviderFx2.done,
  target: providerFormReset
});
var ProviderConfigForm = ({ onSave, onCancel }) => {
  const [
    name,
    selectedCodeSource,
    codeSources,
    schemaFields,
    configValues,
    loading,
    saving
  ] = useUnit5([
    $providerName,
    $providerSelectedCodeSource,
    $providerCodeSources,
    $providerSchemaFields,
    $providerConfigValues,
    $providerLoading,
    $providerSaving
  ]);
  useEffect7(() => {
    providerFormMounted();
  }, []);
  useEffect7(() => {
    const unsub = createProviderFx2.done.watch(() => {
      onSave?.();
    });
    return unsub;
  }, [onSave]);
  const handleCancel = () => {
    providerFormReset();
    onCancel?.();
  };
  const renderField = (field) => {
    const value = configValues[field.name] || "";
    const isTextArea = field.type === "string" && (field.name.toLowerCase().includes("query") || field.name.toLowerCase().includes("template") || field.name.toLowerCase().includes("body") || field.name.toLowerCase().includes("connection"));
    return /* @__PURE__ */ jsxDEV7("div", {
      className: "space-y-2",
      children: [
        /* @__PURE__ */ jsxDEV7(Label2, {
          children: field.name
        }, undefined, false, undefined, this),
        isTextArea ? /* @__PURE__ */ jsxDEV7(Textarea2, {
          value,
          onChange: (e) => providerConfigFieldChanged({ field: field.name, value: e.target.value }),
          placeholder: `Enter ${field.name}...`,
          rows: 3
        }, undefined, false, undefined, this) : field.type === "number" ? /* @__PURE__ */ jsxDEV7(Input2, {
          type: "number",
          value,
          onChange: (e) => providerConfigFieldChanged({ field: field.name, value: Number(e.target.value) }),
          placeholder: `Enter ${field.name}...`
        }, undefined, false, undefined, this) : field.type === "boolean" ? /* @__PURE__ */ jsxDEV7(Select2, {
          value: String(value || false),
          onValueChange: (v) => providerConfigFieldChanged({ field: field.name, value: v === "true" }),
          children: [
            /* @__PURE__ */ jsxDEV7(SelectTrigger2, {
              children: /* @__PURE__ */ jsxDEV7(SelectValue2, {}, undefined, false, undefined, this)
            }, undefined, false, undefined, this),
            /* @__PURE__ */ jsxDEV7(SelectContent2, {
              children: [
                /* @__PURE__ */ jsxDEV7(SelectItem2, {
                  value: "true",
                  children: "Yes"
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV7(SelectItem2, {
                  value: "false",
                  children: "No"
                }, undefined, false, undefined, this)
              ]
            }, undefined, true, undefined, this)
          ]
        }, undefined, true, undefined, this) : /* @__PURE__ */ jsxDEV7(Input2, {
          value,
          onChange: (e) => providerConfigFieldChanged({ field: field.name, value: e.target.value }),
          placeholder: `Enter ${field.name}...`
        }, undefined, false, undefined, this)
      ]
    }, field.name, true, undefined, this);
  };
  return /* @__PURE__ */ jsxDEV7("div", {
    className: "p-4 space-y-4",
    children: [
      /* @__PURE__ */ jsxDEV7("div", {
        className: "flex justify-between items-center",
        children: /* @__PURE__ */ jsxDEV7("h2", {
          className: "text-lg font-semibold",
          children: "Create Provider"
        }, undefined, false, undefined, this)
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV7(Card2, {
        children: [
          /* @__PURE__ */ jsxDEV7(CardHeader2, {
            children: /* @__PURE__ */ jsxDEV7(CardTitle2, {
              children: "Basic Information"
            }, undefined, false, undefined, this)
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV7(CardContent2, {
            className: "space-y-4",
            children: [
              /* @__PURE__ */ jsxDEV7("div", {
                className: "space-y-2",
                children: [
                  /* @__PURE__ */ jsxDEV7(Label2, {
                    children: "Name *"
                  }, undefined, false, undefined, this),
                  /* @__PURE__ */ jsxDEV7(Input2, {
                    value: name,
                    onChange: (e) => providerNameChanged(e.target.value),
                    placeholder: "Enter provider name..."
                  }, undefined, false, undefined, this)
                ]
              }, undefined, true, undefined, this),
              /* @__PURE__ */ jsxDEV7("div", {
                className: "space-y-2",
                children: [
                  /* @__PURE__ */ jsxDEV7(Label2, {
                    children: "Code Source *"
                  }, undefined, false, undefined, this),
                  /* @__PURE__ */ jsxDEV7(Select2, {
                    value: selectedCodeSource,
                    onValueChange: providerCodeSourceSelected,
                    children: [
                      /* @__PURE__ */ jsxDEV7(SelectTrigger2, {
                        children: /* @__PURE__ */ jsxDEV7(SelectValue2, {
                          placeholder: "Select code source..."
                        }, undefined, false, undefined, this)
                      }, undefined, false, undefined, this),
                      /* @__PURE__ */ jsxDEV7(SelectContent2, {
                        children: codeSources.map((cs) => /* @__PURE__ */ jsxDEV7(SelectItem2, {
                          value: cs,
                          children: cs
                        }, cs, false, undefined, this))
                      }, undefined, false, undefined, this)
                    ]
                  }, undefined, true, undefined, this)
                ]
              }, undefined, true, undefined, this)
            ]
          }, undefined, true, undefined, this)
        ]
      }, undefined, true, undefined, this),
      selectedCodeSource && /* @__PURE__ */ jsxDEV7(Card2, {
        children: [
          /* @__PURE__ */ jsxDEV7(CardHeader2, {
            children: [
              /* @__PURE__ */ jsxDEV7(CardTitle2, {
                children: "Parameters"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV7(CardDescription2, {
                children: [
                  "Configure provider parameters for ",
                  selectedCodeSource
                ]
              }, undefined, true, undefined, this)
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV7(CardContent2, {
            className: "space-y-4",
            children: loading ? /* @__PURE__ */ jsxDEV7("div", {
              className: "text-center py-4",
              children: "Loading parameters..."
            }, undefined, false, undefined, this) : schemaFields.length > 0 ? schemaFields.map(renderField) : /* @__PURE__ */ jsxDEV7("div", {
              className: "text-muted-foreground text-center py-4",
              children: "No parameters required"
            }, undefined, false, undefined, this)
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV7("div", {
        className: "flex gap-2 justify-end",
        children: [
          /* @__PURE__ */ jsxDEV7(Button2, {
            variant: "outline",
            onClick: handleCancel,
            children: [
              /* @__PURE__ */ jsxDEV7(X, {
                className: "w-4 h-4 mr-2"
              }, undefined, false, undefined, this),
              "Cancel"
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV7(Button2, {
            onClick: () => providerSaveClicked(),
            disabled: !name || !selectedCodeSource || saving,
            children: [
              /* @__PURE__ */ jsxDEV7(Save, {
                className: "w-4 h-4 mr-2"
              }, undefined, false, undefined, this),
              saving ? "Saving..." : "Save"
            ]
          }, undefined, true, undefined, this)
        ]
      }, undefined, true, undefined, this)
    ]
  }, undefined, true, undefined, this);
};

// src/functions/provider.config.ts
var SHOW_PROVIDERS_LIST = "providers.show";
var SHOW_PROVIDER_FORM = "provider_form.show";
var createProviderFormWidget = (bus) => ({
  view: ProviderConfigForm,
  placement: () => "sidebar:tab:dag",
  config: {},
  commands: {
    onSave: () => {
      bus.run(SHOW_PROVIDERS_LIST, {});
    },
    onCancel: () => {
      providerFormReset();
    }
  }
});
var createProvidersListWidget = (bus) => ({
  view: ProvidersListView,
  placement: () => "center",
  config: {
    bus
  }
});
var createShowProvidersListAction = (bus) => ({
  id: SHOW_PROVIDERS_LIST,
  description: "Show providers list",
  invoke: () => {
    bus.present({ widget: createProvidersListWidget(bus) });
  }
});
var createShowProviderFormAction = (bus) => ({
  id: SHOW_PROVIDER_FORM,
  description: "Show provider form",
  invoke: () => {
    bus.present({ widget: createProviderFormWidget(bus) });
  }
});
var ACTIONS3 = [
  createShowProvidersListAction,
  createShowProviderFormAction
];
var provider_config_default = ACTIONS3;

// src/menu.ts
var MENU = {
  title: "menu.dag",
  iconName: "IconAi",
  items: [
    {
      title: "menu.workflows",
      key: "workflows",
      action: SHOW_WORKFLOWS_LIST
    },
    {
      title: "menu.nodes",
      key: "nodes",
      action: SHOW_NODES_LIST
    },
    {
      title: "menu.providers",
      key: "providers",
      action: SHOW_PROVIDERS_LIST
    }
  ]
};
// src/views/VersionsView.tsx
import { useEffect as useEffect8 } from "react";
import { createStore as createStore3, createEvent as createEvent3, createEffect as createEffect3, sample as sample9 } from "effector";
import { useStore as useStore2 } from "effector-react";

// src/components/Versions.tsx
import { jsxDEV as jsxDEV8 } from "react/jsx-dev-runtime";
var Versions = ({
  versions,
  loading,
  codeName
}) => {
  if (loading) {
    return /* @__PURE__ */ jsxDEV8("div", {
      className: "p-4",
      children: /* @__PURE__ */ jsxDEV8("div", {
        className: "animate-pulse",
        children: "Загрузка версий..."
      }, undefined, false, undefined, this)
    }, undefined, false, undefined, this);
  }
  if (!codeName) {
    return /* @__PURE__ */ jsxDEV8("div", {
      className: "p-4 text-muted-foreground",
      children: "Выберите код из списка"
    }, undefined, false, undefined, this);
  }
  return /* @__PURE__ */ jsxDEV8("div", {
    className: "p-4",
    children: [
      /* @__PURE__ */ jsxDEV8("h3", {
        className: "text-lg font-semibold mb-4",
        children: [
          "Versions for ",
          codeName
        ]
      }, undefined, true, undefined, this),
      versions.length === 0 ? /* @__PURE__ */ jsxDEV8("div", {
        className: "text-muted-foreground",
        children: "Нет доступных версий"
      }, undefined, false, undefined, this) : /* @__PURE__ */ jsxDEV8("div", {
        className: "space-y-2",
        children: versions.map((version) => /* @__PURE__ */ jsxDEV8("div", {
          className: "p-3 border rounded-md bg-card hover:bg-accent transition-colors",
          children: /* @__PURE__ */ jsxDEV8("span", {
            className: "font-medium",
            children: [
              "v",
              version.version
            ]
          }, undefined, true, undefined, this)
        }, version.version, false, undefined, this))
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
};

// src/views/VersionsView.tsx
import { jsxDEV as jsxDEV9 } from "react/jsx-dev-runtime";
var setCodeName = createEvent3();
var loadVersions = createEvent3();
var loadVersionsFx = createEffect3(async ({ codeName, versionLoader }) => {
  try {
    return await versionLoader(codeName);
  } catch (error) {
    console.error("Error fetching versions:", error);
    throw error;
  }
});
var $versions = createStore3([]).on(loadVersionsFx.doneData, (_, versions) => versions).on(loadVersionsFx.fail, () => []);
var $loading3 = createStore3(false).on(loadVersionsFx, () => true).on(loadVersionsFx.finally, () => false);
var $codeName = createStore3("").on(setCodeName, (_, codeName) => codeName);
sample9({
  clock: loadVersions,
  target: loadVersionsFx
});
var VersionsView = ({ versionLoader }) => {
  const versions = useStore2($versions);
  const loading = useStore2($loading3);
  const codeName = useStore2($codeName);
  useEffect8(() => {
    const currentCodeName = "bla";
    setCodeName(currentCodeName);
  }, []);
  useEffect8(() => {
    if (!codeName || !versionLoader)
      return;
    loadVersions({ codeName, versionLoader });
  }, [codeName, versionLoader]);
  return /* @__PURE__ */ jsxDEV9(Versions, {
    versions,
    loading,
    codeName
  }, undefined, false, undefined, this);
};
var VersionsView_default = VersionsView;

// src/functions/code-version.config.ts
import { sample as sample10 } from "effector";
var SHOW_VERSIONS = "show_versions";
var GET_VERSIONS = "get_versions";
var getCodeVersionsFx = domain_default.createEffect(async ({ page, after }) => {
  return await service_default.getVersions(page, after);
});
var getVersionsEvent = domain_default.createEvent();
var versionsStore = domain_default.createStore(null);
sample10({ clock: getVersionsEvent, target: getCodeVersionsFx });
versionsStore.on(getCodeVersionsFx.doneData, (_, data) => data);
sample10({
  clock: getVersionsEvent,
  source: versionsStore,
  fn: (versions, params) => ({
    data: versions
  })
});
var createCodeVersionsWidget = () => ({
  view: VersionsView_default,
  placement: () => "center",
  mount: ({ page, after }) => getVersionsEvent({ page, after }),
  commands: {
    response: () => {}
  }
});
var createShowCodeVersionsAction = (bus) => ({
  id: SHOW_VERSIONS,
  description: "Show code versions",
  invoke: () => {
    bus.present({ widget: createCodeVersionsWidget(bus) });
  }
});
var createGetCodeVersionsAction = (bus) => ({
  id: GET_VERSIONS,
  description: "Get code versions",
  invoke: (params) => getVersionsEvent({ ...params, bus })
});
var ACTIONS4 = [
  createShowCodeVersionsAction,
  createGetCodeVersionsAction
];
var code_version_config_default = ACTIONS4;

// src/views/ContextView.tsx
import { JsonRenderer } from "front-core";
import { jsxDEV as jsxDEV10 } from "react/jsx-dev-runtime";
function ContextView({ data }) {
  return /* @__PURE__ */ jsxDEV10(JsonRenderer, {
    data
  }, undefined, false, undefined, this);
}

// src/functions/context.ts
import { sample as sample11 } from "effector";
var SHOW_CONTEXT = "show_context";
var contextFx = domain_default.createEffect();
var showContextEvent = domain_default.createEvent();
sample11({ clock: showContextEvent, target: contextFx });
var createContextWidget = () => ({
  view: ContextView,
  placement: () => "center",
  mount: () => {},
  commands: {
    response: () => {}
  }
});
var createShowContextAction = (bus) => ({
  id: SHOW_CONTEXT,
  description: "Show context",
  invoke: () => {
    bus.present({ widget: createContextWidget(bus) });
  }
});
var ACTIONS5 = [
  createShowContextAction
];
var context_default = ACTIONS5;

// src/functions/lambda.ts
import { sample as sample12 } from "effector";
var SHOW_LAMBDA = "show_lambda";
var lambdaFx = domain_default.createEffect(async ({ name }) => {
  const hash = await service_default.getNode(name);
  console.log("HASH", hash);
  return { hash };
});
var showLambdaEvent = domain_default.createEvent();
sample12({ clock: showLambdaEvent, target: lambdaFx });
var createLambdaWidget = () => ({
  view: NodeConfigForm,
  placement: () => "sidebar:tab:dag",
  config: {},
  commands: {
    onSave: () => {},
    onCancel: () => {}
  }
});
var createShowLambdaAction = (bus) => ({
  id: SHOW_LAMBDA,
  description: "Show lambda",
  invoke: () => {
    bus.present({ widget: createLambdaWidget(bus) });
  }
});
var ACTIONS6 = [
  createShowLambdaAction
];
var lambda_default = ACTIONS6;

// src/functions/index.ts
var ACTIONS7 = [
  ...wokflow_default,
  ...node_config_default,
  ...provider_config_default,
  ...lambda_default,
  ...context_default,
  ...code_version_config_default
];

// src/index.ts
import { BasePlugin, LocaleController } from "front-core";
var ID = "dag-mf";
var SIDEBAR_TABS = [
  {
    id: "dag",
    title: "Configuration",
    iconName: "IconSettings",
    order: 30
  }
];
LocaleController.getInstance().setLocales(ID, {
  en: new URL("../locales/en.json", import.meta.url).toString(),
  ru: new URL("../locales/ru.json", import.meta.url).toString()
});
var src_default = new BasePlugin(ID, ACTIONS7);
export {
  src_default as default,
  SIDEBAR_TABS,
  MENU,
  ID
};
