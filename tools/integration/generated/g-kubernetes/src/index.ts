// Auto-generated package
import { createHttpClient } from "nrpc";

export type PodInfo = {
  name: string;
  namespace: string;
  status: string;
  ready: boolean;
  restarts: number;
  image: string;
};

export type TenantSpec = {
  name: string;
  storageSize?: string;
  domains?: string[];
};

export type TenantStatus = {
  name: string;
  ready: boolean;
  storageHost?: string;
  storagePort?: number;
  domain?: string;
  reason?: string;
};

export type ResourceItem = {
  name: string;
  namespace?: string;
  kind: string;
  createdAt?: string;
  labels?: Record<string, string>;
  status?: string;
};

export type ResourceUsage = {
  name: string;
  namespace?: string;
  kind: string;
  cpuCores: number;
  cpuPercent?: number;
  memoryBytes: number;
  memoryPercent?: number;
};

export const metadata = {
  "interfaceName": "KubernetesService",
  "serviceName": "kubernetes",
  "filePath": "services/automation/kubernetes.ts",
  "methods": [
    {
      "name": "createTenant",
      "parameters": [
        {
          "name": "spec",
          "type": "TenantSpec",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "TenantStatus",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getTenant",
      "parameters": [
        {
          "name": "name",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "TenantStatus",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listTenants",
      "parameters": [
        {
          "name": "namespace",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "TenantStatus",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "deleteTenant",
      "parameters": [
        {
          "name": "name",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "void",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listResources",
      "parameters": [
        {
          "name": "kind",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "namespace",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "ResourceItem",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "deleteResource",
      "parameters": [
        {
          "name": "kind",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "namespace",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "name",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "void",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "topPods",
      "parameters": [
        {
          "name": "namespace",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "ResourceUsage",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "topNodes",
      "parameters": [],
      "returnType": "ResourceUsage",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "PodInfo",
      "kind": "type",
      "definition": "{\n  name: string;\n  namespace: string;\n  status: string;\n  ready: boolean;\n  restarts: number;\n  image: string;\n}"
    },
    {
      "name": "TenantSpec",
      "kind": "type",
      "definition": "{\n  name: string;\n  storageSize?: string;\n  domains?: string[];\n}"
    },
    {
      "name": "TenantStatus",
      "kind": "type",
      "definition": "{\n  name: string;\n  ready: boolean;\n  storageHost?: string;\n  storagePort?: number;\n  domain?: string;\n  reason?: string;\n}"
    },
    {
      "name": "ResourceItem",
      "kind": "type",
      "definition": "{\n  name: string;\n  namespace?: string;\n  kind: string;\n  createdAt?: string;\n  labels?: Record<string, string>;\n  status?: string;\n}"
    },
    {
      "name": "ResourceUsage",
      "kind": "type",
      "definition": "{\n  name: string;\n  namespace?: string;\n  kind: string;\n  cpuCores: number;\n  cpuPercent?: number;\n  memoryBytes: number;\n  memoryPercent?: number;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface KubernetesService {
  createTenant(spec: TenantSpec): Promise<TenantStatus>;
  getTenant(name: string): Promise<TenantStatus>;
  listTenants(namespace: string): Promise<TenantStatus[]>;
  deleteTenant(name: string): Promise<void>;
  listResources(kind: string, namespace: string): Promise<ResourceItem[]>;
  deleteResource(kind: string, namespace: string, name: string): Promise<void>;
  topPods(namespace: string): Promise<ResourceUsage[]>;
  topNodes(): Promise<ResourceUsage[]>;
}

// Client interface
export interface KubernetesServiceClient {
  createTenant(spec: TenantSpec): Promise<TenantStatus>;
  getTenant(name: string): Promise<TenantStatus>;
  listTenants(namespace: string): Promise<TenantStatus[]>;
  deleteTenant(name: string): Promise<void>;
  listResources(kind: string, namespace: string): Promise<ResourceItem[]>;
  deleteResource(kind: string, namespace: string, name: string): Promise<void>;
  topPods(namespace: string): Promise<ResourceUsage[]>;
  topNodes(): Promise<ResourceUsage[]>;
}

// Factory function
export function createKubernetesServiceClient(
  config?: { baseUrl?: string },
): KubernetesServiceClient {
  return createHttpClient<KubernetesServiceClient>(metadata, config);
}

// Ready-to-use client
export const kubernetesClient = createKubernetesServiceClient();
