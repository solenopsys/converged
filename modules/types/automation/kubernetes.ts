export type PodInfo = {
  name: string;
  namespace: string;
  status: string;
  ready: boolean;
  restarts: number;
  image: string;
}

export type TenantSpec = {
  name: string;
  storageSize?: string;
  domains?: string[];
}

export type TenantStatus = {
  name: string;
  ready: boolean;
  storageHost?: string;
  storagePort?: number;
  domain?: string;
  reason?: string;
}

export type ResourceItem = {
  name: string;
  namespace?: string;
  kind: string;
  createdAt?: string;
  labels?: Record<string, string>;
  status?: string;
}

export type ResourceUsage = {
  name: string;
  namespace?: string;
  kind: string;
  cpuCores: number;
  cpuPercent?: number;
  memoryBytes: number;
  memoryPercent?: number;
}

export interface KubernetesService {
  // Tenants (converged-operator)
  createTenant(spec: TenantSpec): Promise<TenantStatus>;
  getTenant(name: string): Promise<TenantStatus>;
  listTenants(namespace: string): Promise<TenantStatus[]>;
  deleteTenant(name: string): Promise<void>;

  // Generic resource operations
  listResources(kind: string, namespace: string): Promise<ResourceItem[]>;
  deleteResource(kind: string, namespace: string, name: string): Promise<void>;

  // Resource usage (top)
  topPods(namespace: string): Promise<ResourceUsage[]>;
  topNodes(): Promise<ResourceUsage[]>;
}
