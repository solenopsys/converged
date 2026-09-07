import type { ServiceMetadata } from "../types";

export type AccessMode = "r" | "w" | "rw";

export type PermissionEntry = {
  service: string;
  method: string;
  mode: AccessMode;
};

export type PermissionIndex = Map<string, Map<string, AccessMode>>;

const PERMISSION_RE = /^([^/\s]+)\s*\/\s*([^\s(]+)\s*(?:\(\s*([rw]+)\s*\))?$/i;
const WILDCARDS = new Set(["*", "all"]);

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeMode(value?: string): AccessMode | null {
  if (!value) return "rw";
  const chars = value.toLowerCase().split("");
  const hasR = chars.includes("r");
  const hasW = chars.includes("w");
  if (!hasR && !hasW) return null;
  return `${hasR ? "r" : ""}${hasW ? "w" : ""}` as AccessMode;
}

function mergeModes(a: AccessMode | undefined, b: AccessMode): AccessMode {
  if (!a) return b;
  const hasR = a.includes("r") || b.includes("r");
  const hasW = a.includes("w") || b.includes("w");
  return `${hasR ? "r" : ""}${hasW ? "w" : ""}` as AccessMode;
}

export function parsePermission(value: string): PermissionEntry | null {
  if (!value) return null;
  const match = value.trim().match(PERMISSION_RE);
  if (!match) return null;
  const mode = normalizeMode(match[3]);
  if (!mode) return null;
  return {
    service: match[1].trim(),
    method: match[2].trim(),
    mode,
  };
}

export function serializePermission(entry: PermissionEntry): string {
  const mode = normalizeMode(entry.mode) ?? "rw";
  return `${entry.service}/${entry.method}(${mode})`;
}

export function deserializePermissions(values: string[]): PermissionEntry[] {
  return values
    .map((value) => parsePermission(value))
    .filter(Boolean) as PermissionEntry[];
}

export function serializePermissions(entries: PermissionEntry[]): string[] {
  return entries.map((entry) => serializePermission(entry));
}

export function buildPermissionIndex(permissions: string[]): PermissionIndex {
  const index: PermissionIndex = new Map();
  for (const raw of permissions ?? []) {
    const parsed = parsePermission(raw);
    if (!parsed) continue;
    const serviceKey = normalizeName(parsed.service);
    const methodKey = normalizeName(parsed.method);
    if (!index.has(serviceKey)) {
      index.set(serviceKey, new Map());
    }
    const serviceMap = index.get(serviceKey)!;
    const current = serviceMap.get(methodKey);
    serviceMap.set(methodKey, mergeModes(current, parsed.mode));
  }
  return index;
}

export function resolveAccessForMethod(methodName: string): AccessMode {
  const lower = methodName.toLowerCase();
  const readPrefixes = [
    "get",
    "list",
    "find",
    "search",
    "status",
    "stats",
    "count",
    "read",
    "fetch",
    "exists",
    "has",
    "is",
    "describe",
  ];
  const isRead = readPrefixes.some((prefix) => lower.startsWith(prefix));
  return isRead ? "r" : "w";
}

export function hasAccess(
  index: PermissionIndex,
  service: string,
  method: string,
  required: AccessMode,
): boolean {
  const serviceKey = normalizeName(service);
  const methodKey = normalizeName(method);
  const requiredR = required.includes("r");
  const requiredW = required.includes("w");

  const candidateServices = [serviceKey, "all", "*"];
  const candidateMethods = [methodKey, "all", "*"];

  for (const serviceCandidate of candidateServices) {
    const serviceMap = index.get(serviceCandidate);
    if (!serviceMap) continue;

    for (const methodCandidate of candidateMethods) {
      const mode = serviceMap.get(methodCandidate);
      if (!mode) continue;
      const hasR = mode.includes("r");
      const hasW = mode.includes("w");
      if ((requiredR ? hasR : true) && (requiredW ? hasW : true)) {
        return true;
      }
    }
  }

  return false;
}

export function extractPermissionsFromPayload(payload: any): string[] {
  const raw = payload?.perm ?? payload?.permissions;
  if (Array.isArray(raw)) {
    return raw.filter((item) => typeof item === "string") as string[];
  }
  if (typeof raw === "string") {
    return raw.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

export function normalizePermissionTarget(
  service: string,
  method: string,
): { service: string; method: string } {
  return {
    service: WILDCARDS.has(service) ? "all" : normalizeName(service),
    method: WILDCARDS.has(method) ? "all" : normalizeName(method),
  };
}

export class AccessMatcher {
  private index: PermissionIndex;

  constructor(permissions: string[] = []) {
    this.index = buildPermissionIndex(permissions);
  }

  can(service: string, method: string, required: AccessMode): boolean {
    return hasAccess(this.index, service, method, required);
  }
}

export function canCallMethod(
  permissions: string[],
  metadata: ServiceMetadata,
  methodName: string,
  required?: AccessMode,
): boolean {
  const matcher = new AccessMatcher(permissions);
  const access = required ?? resolveAccessForMethod(methodName);
  return matcher.can(metadata.serviceName, methodName, access);
}
