import { readFileSync } from "fs";

const K8S_API = process.env.K8S_API_URL ?? "https://kubernetes.default.svc";
const NAMESPACE = process.env.K8S_NAMESPACE ?? "converged-portal";
const TENANT_API_GROUP = "storage.converged.io";
const TENANT_API_VERSION = "v1alpha1";
const TENANT_PLURAL = "tenants";

// Maps friendly kind names to k8s API paths
const KIND_MAP: Record<string, { path: string; namespaced: boolean }> = {
  pod:         { path: "pods",                  namespaced: true  },
  pods:        { path: "pods",                  namespaced: true  },
  deployment:  { path: "deployments",           namespaced: true  },
  deployments: { path: "deployments",           namespaced: true  },
  service:     { path: "services",              namespaced: true  },
  services:    { path: "services",              namespaced: true  },
  statefulset: { path: "statefulsets",          namespaced: true  },
  statefulsets:{ path: "statefulsets",          namespaced: true  },
  job:         { path: "jobs",                  namespaced: true  },
  jobs:        { path: "jobs",                  namespaced: true  },
  configmap:   { path: "configmaps",            namespaced: true  },
  configmaps:  { path: "configmaps",            namespaced: true  },
  secret:      { path: "secrets",              namespaced: true  },
  secrets:     { path: "secrets",              namespaced: true  },
  pvc:         { path: "persistentvolumeclaims", namespaced: true },
  node:        { path: "nodes",                 namespaced: false },
  nodes:       { path: "nodes",                 namespaced: false },
  namespace:   { path: "namespaces",            namespaced: false },
  namespaces:  { path: "namespaces",            namespaced: false },
};

const APPS_KINDS = new Set(["deployment", "deployments", "statefulset", "statefulsets"]);
const BATCH_KINDS = new Set(["job", "jobs"]);

function readToken(): string {
  try {
    return readFileSync("/var/run/secrets/kubernetes.io/serviceaccount/token", "utf8").trim();
  } catch {
    return process.env.K8S_TOKEN ?? "";
  }
}

async function k8sFetch(path: string, options: RequestInit = {}): Promise<any> {
  const token = readToken();
  const res = await fetch(`${K8S_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    // @ts-ignore
    tls: { rejectUnauthorized: false },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw Object.assign(new Error(`k8s API error ${res.status}: ${body}`), { statusCode: res.status });
  }

  return res.json();
}

function resolveApiPath(kind: string, namespace?: string, name?: string): string {
  const k = kind.toLowerCase();
  const def = KIND_MAP[k];
  if (!def) throw new Error(`Unknown resource kind: "${kind}"`);

  let base: string;
  if (APPS_KINDS.has(k)) {
    base = `/apis/apps/v1`;
  } else if (BATCH_KINDS.has(k)) {
    base = `/apis/batch/v1`;
  } else {
    base = `/api/v1`;
  }

  const ns = def.namespaced && namespace ? `/namespaces/${namespace}` : "";
  const suffix = name ? `/${name}` : "";
  return `${base}${ns}/${def.path}${suffix}`;
}

// ── Generic resources ──────────────────────────────────────────────────────

export async function listResources(kind: string, namespace: string): Promise<any[]> {
  const path = resolveApiPath(kind, namespace);
  const data = await k8sFetch(path);
  return data.items ?? [];
}

export async function deleteResource(kind: string, namespace: string, name: string): Promise<void> {
  const path = resolveApiPath(kind, namespace, name);
  await k8sFetch(path, { method: "DELETE" });
}

// ── Top (metrics) ──────────────────────────────────────────────────────────

export async function topPods(namespace: string): Promise<any[]> {
  const data = await k8sFetch(`/apis/metrics.k8s.io/v1beta1/namespaces/${namespace}/pods`);
  return data.items ?? [];
}

export async function topNodes(): Promise<any[]> {
  const data = await k8sFetch(`/apis/metrics.k8s.io/v1beta1/nodes`);
  return data.items ?? [];
}

// ── Tenants ────────────────────────────────────────────────────────────────

export async function createTenantResource(name: string, storageSize?: string, domains?: string[]): Promise<any> {
  const manifest = {
    apiVersion: `${TENANT_API_GROUP}/${TENANT_API_VERSION}`,
    kind: "Tenant",
    metadata: { name, namespace: NAMESPACE },
    spec: {
      ...(storageSize ? { storageSize } : {}),
      ...(domains?.length ? { domains } : {}),
    },
  };

  return k8sFetch(
    `/apis/${TENANT_API_GROUP}/${TENANT_API_VERSION}/namespaces/${NAMESPACE}/${TENANT_PLURAL}`,
    { method: "POST", body: JSON.stringify(manifest) },
  );
}

export async function getTenantResource(name: string): Promise<any> {
  return k8sFetch(
    `/apis/${TENANT_API_GROUP}/${TENANT_API_VERSION}/namespaces/${NAMESPACE}/${TENANT_PLURAL}/${name}`,
  );
}

export async function listTenantResources(namespace: string): Promise<any> {
  return k8sFetch(
    `/apis/${TENANT_API_GROUP}/${TENANT_API_VERSION}/namespaces/${namespace}/${TENANT_PLURAL}`,
  );
}

export async function deleteTenantResource(name: string): Promise<void> {
  await k8sFetch(
    `/apis/${TENANT_API_GROUP}/${TENANT_API_VERSION}/namespaces/${NAMESPACE}/${TENANT_PLURAL}/${name}`,
    { method: "DELETE" },
  );
}
