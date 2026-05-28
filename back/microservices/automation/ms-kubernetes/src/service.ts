import type { KubernetesService, TenantSpec, TenantStatus, ResourceItem, ResourceUsage } from "g-kubernetes";
import {
  listResources,
  deleteResource,
  topPods,
  topNodes,
  createTenantResource,
  getTenantResource,
  listTenantResources,
  deleteTenantResource,
} from "./k8s-client";

function parseTenant(resource: any): TenantStatus {
  const status = resource.status ?? {};
  return {
    name: resource.metadata?.name ?? "",
    ready: status.ready === true,
    storageHost: status.storageHost,
    storagePort: status.storagePort ?? 9000,
    domain: `${resource.metadata?.name}.4ir.club`,
    reason: status.reason,
  };
}

function parseResource(item: any, kind: string): ResourceItem {
  return {
    name: item.metadata?.name ?? "",
    namespace: item.metadata?.namespace,
    kind,
    createdAt: item.metadata?.creationTimestamp,
    labels: item.metadata?.labels,
    status: item.status?.phase ?? item.status?.conditions?.[0]?.type,
  };
}

function parseCpu(cpuStr: string): number {
  if (!cpuStr) return 0;
  if (cpuStr.endsWith("n")) return Number(cpuStr.slice(0, -1)) / 1e9;
  if (cpuStr.endsWith("m")) return Number(cpuStr.slice(0, -1)) / 1000;
  return Number(cpuStr);
}

function parseMemory(memStr: string): number {
  if (!memStr) return 0;
  if (memStr.endsWith("Ki")) return Number(memStr.slice(0, -2)) * 1024;
  if (memStr.endsWith("Mi")) return Number(memStr.slice(0, -2)) * 1024 ** 2;
  if (memStr.endsWith("Gi")) return Number(memStr.slice(0, -2)) * 1024 ** 3;
  if (memStr.endsWith("k"))  return Number(memStr.slice(0, -1)) * 1000;
  if (memStr.endsWith("M"))  return Number(memStr.slice(0, -1)) * 1e6;
  if (memStr.endsWith("G"))  return Number(memStr.slice(0, -1)) * 1e9;
  return Number(memStr);
}

function parsePodMetrics(item: any): ResourceUsage {
  const containers: any[] = item.containers ?? [];
  const cpuCores = containers.reduce((s: number, c: any) => s + parseCpu(c.usage?.cpu ?? "0"), 0);
  const memoryBytes = containers.reduce((s: number, c: any) => s + parseMemory(c.usage?.memory ?? "0"), 0);
  return {
    name: item.metadata?.name ?? "",
    namespace: item.metadata?.namespace,
    kind: "Pod",
    cpuCores,
    memoryBytes,
  };
}

function parseNodeMetrics(item: any): ResourceUsage {
  return {
    name: item.metadata?.name ?? "",
    kind: "Node",
    cpuCores: parseCpu(item.usage?.cpu ?? "0"),
    memoryBytes: parseMemory(item.usage?.memory ?? "0"),
  };
}

export default class KubernetesServiceImpl implements KubernetesService {
  async listResources(kind: string, namespace: string): Promise<ResourceItem[]> {
    const items = await listResources(kind, namespace);
    return items.map((item) => parseResource(item, kind));
  }

  async deleteResource(kind: string, namespace: string, name: string): Promise<void> {
    await deleteResource(kind, namespace, name);
  }

  async topPods(namespace: string): Promise<ResourceUsage[]> {
    const items = await topPods(namespace);
    return items.map(parsePodMetrics);
  }

  async topNodes(): Promise<ResourceUsage[]> {
    const items = await topNodes();
    return items.map(parseNodeMetrics);
  }

  async createTenant(spec: TenantSpec): Promise<TenantStatus> {
    const existing = await getTenantResource(spec.name).catch(() => null);
    if (existing) return parseTenant(existing);
    const resource = await createTenantResource(spec.name, spec.storageSize, spec.domains);
    return parseTenant(resource);
  }

  async getTenant(name: string): Promise<TenantStatus> {
    const resource = await getTenantResource(name);
    return parseTenant(resource);
  }

  async listTenants(namespace: string): Promise<TenantStatus[]> {
    const data = await listTenantResources(namespace);
    return (data.items ?? []).map(parseTenant);
  }

  async deleteTenant(name: string): Promise<void> {
    await deleteTenantResource(name);
  }
}
