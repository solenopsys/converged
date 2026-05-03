export const WORKSPACE_HEADER = "workspace";
export const WORKSPACE_HEADER_ALT = "x-workspace";
export const WORKSPACE_DOMAIN_MAP_ENV = "WORKSPACE_DOMAIN_MAP";
export const NRPC_WORKSPACE_DOMAIN_MAP_ENV = "NRPC_WORKSPACE_DOMAIN_MAP";

export type WorkspaceDomainMap = Record<string, string>;

export interface ResolveWorkspaceOptions {
  map?: WorkspaceDomainMap;
  env?: Record<string, string | undefined>;
  fallbackWorkspace?: string;
  headerName?: string;
}

type HeaderLike = Headers | Record<string, string | undefined>;

function normalizeWorkspace(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function readHeader(
  headers: HeaderLike | undefined,
  name: string,
): string | undefined {
  if (!headers || !name) return undefined;
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }

  const normalizedName = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === normalizedName) return value;
  }
  return undefined;
}

function firstHeaderValue(value: string | undefined): string | undefined {
  return value?.split(",")[0]?.trim() || undefined;
}

export function normalizeHost(value: string | undefined): string | undefined {
  const raw = firstHeaderValue(value);
  if (!raw) return undefined;

  let host = raw.toLowerCase();
  if (host.includes("://")) {
    try {
      host = new URL(host).host.toLowerCase();
    } catch {
      return undefined;
    }
  }

  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return end > 0 ? host.slice(1, end) : undefined;
  }

  const slashIndex = host.indexOf("/");
  if (slashIndex >= 0) host = host.slice(0, slashIndex);

  const colonIndex = host.indexOf(":");
  if (colonIndex >= 0) host = host.slice(0, colonIndex);

  return host.trim() || undefined;
}

export function parseWorkspaceDomainMap(
  raw: string | undefined,
): WorkspaceDomainMap {
  if (!raw || raw.trim().length === 0) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const result: WorkspaceDomainMap = {};
    for (const [domain, workspace] of Object.entries(parsed)) {
      if (typeof workspace !== "string") continue;
      const normalizedDomain =
        normalizeHost(domain.replace(/^\*\./, "")) ??
        domain.trim().toLowerCase();
      const normalizedWorkspace = normalizeWorkspace(workspace);
      if (!normalizedDomain || !normalizedWorkspace) continue;
      const key = domain.trim().startsWith("*.")
        ? `*.${normalizedDomain}`
        : normalizedDomain;
      result[key] = normalizedWorkspace;
    }
    return result;
  } catch {
    return {};
  }
}

function resolveMapFromEnv(
  env: Record<string, string | undefined>,
): WorkspaceDomainMap {
  return parseWorkspaceDomainMap(
    env[WORKSPACE_DOMAIN_MAP_ENV] ?? env[NRPC_WORKSPACE_DOMAIN_MAP_ENV],
  );
}

export function resolveWorkspaceFromDomain(
  host: string | undefined,
  options: ResolveWorkspaceOptions = {},
): string | undefined {
  const normalizedHost = normalizeHost(host);
  const env =
    options.env ?? (typeof process !== "undefined" ? process.env : {});
  const map = options.map ?? resolveMapFromEnv(env);
  const fallback =
    normalizeWorkspace(options.fallbackWorkspace) ??
    normalizeWorkspace(env.NRPC_WORKSPACE) ??
    normalizeWorkspace(env.WORKSPACE);

  if (!normalizedHost) return fallback;

  const exact = normalizeWorkspace(map[normalizedHost]);
  if (exact) return exact;

  for (const [domain, workspace] of Object.entries(map)) {
    const normalizedWorkspace = normalizeWorkspace(workspace);
    if (!normalizedWorkspace) continue;

    if (domain === "*") return normalizedWorkspace;
    if (domain.startsWith("*.")) {
      const suffix = domain.slice(2);
      if (normalizedHost !== suffix && normalizedHost.endsWith(`.${suffix}`)) {
        return normalizedWorkspace;
      }
    }
    if (domain.startsWith(".")) {
      const suffix = domain.slice(1);
      if (normalizedHost === suffix || normalizedHost.endsWith(`.${suffix}`)) {
        return normalizedWorkspace;
      }
    }
  }

  return fallback;
}

export function resolveWorkspaceFromHeaders(
  headers: HeaderLike | undefined,
  options: ResolveWorkspaceOptions = {},
): string | undefined {
  const explicit =
    normalizeWorkspace(readHeader(headers, options.headerName ?? "")) ??
    normalizeWorkspace(readHeader(headers, WORKSPACE_HEADER)) ??
    normalizeWorkspace(readHeader(headers, WORKSPACE_HEADER_ALT));
  if (explicit) return explicit;

  const forwardedHost = readHeader(headers, "x-forwarded-host");
  const host = forwardedHost ?? readHeader(headers, "host");
  return resolveWorkspaceFromDomain(host, options);
}

export function resolveWorkspaceFromRequest(
  request: Request,
  options: ResolveWorkspaceOptions = {},
): string | undefined {
  const explicit =
    normalizeWorkspace(readHeader(request.headers, options.headerName ?? "")) ??
    normalizeWorkspace(readHeader(request.headers, WORKSPACE_HEADER)) ??
    normalizeWorkspace(readHeader(request.headers, WORKSPACE_HEADER_ALT));
  if (explicit) return explicit;

  const forwardedHost = readHeader(request.headers, "x-forwarded-host");
  const host = forwardedHost ?? readHeader(request.headers, "host");

  let urlHost: string | undefined;
  try {
    urlHost = new URL(request.url).host;
  } catch {
    urlHost = undefined;
  }

  return resolveWorkspaceFromDomain(host ?? urlHost, options);
}

export function buildWorkspaceHeaders(
  workspace: string | undefined,
): Record<string, string> {
  const normalized = normalizeWorkspace(workspace);
  return normalized ? { [WORKSPACE_HEADER]: normalized } : {};
}

export function createWorkspaceBootstrapScript(
  workspace: string | undefined,
): string {
  const normalized = normalizeWorkspace(workspace);
  if (!normalized) return "";
  const value = JSON.stringify(normalized).replace(/</g, "\\u003c");
  return `globalThis.__NRPC_WORKSPACE__=${value};`;
}
