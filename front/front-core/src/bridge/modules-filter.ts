const AUTH_TOKEN_KEY = 'authToken';
const MODULES_LIST_FOR_USER_PATH = '/services/modules/listForUser';
const SYSTEM_MICROFRONTENDS = new Set(['mf-auth']);

type JwtPayload = {
  sub?: string;
  exp?: number;
  temporary?: boolean;
};

let preparePromise: Promise<void> | null = null;

function decodeJwtPayload(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    return JSON.parse(atob(padded)) as JwtPayload;
  } catch {
    return null;
  }
}

function resolveAuthenticatedUserId(): { userId: string; token: string } | null {
  if (typeof window === 'undefined') return null;
  const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) return null;

  const payload = decodeJwtPayload(token);
  if (!payload?.sub || typeof payload.exp !== 'number') return null;
  if (payload.temporary === true) return null;
  if (payload.sub.startsWith('temp:')) return null;
  if (payload.exp * 1000 < Date.now()) return null;

  return { userId: payload.sub, token };
}

function normalizeMfName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.startsWith('mf-') ? trimmed : `mf-${trimmed}`;
}

async function fetchAllowedMicrofrontends(userId: string, token: string): Promise<Set<string> | null> {
  if (typeof window === 'undefined') return null;

  try {
    const response = await fetch(`${window.location.origin}${MODULES_LIST_FOR_USER_PATH}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) return null;

    const body = await response.json();
    const rows = Array.isArray(body)
      ? body
      : Array.isArray((body as any)?.items)
        ? (body as any).items
        : [];

    const names = rows
      .map((entry: any) => normalizeMfName(entry?.name ?? entry?.module ?? entry?.id))
      .filter((name): name is string => Boolean(name));

    return new Set(names);
  } catch {
    return null;
  }
}

function filterInitialMicrofrontends(allowed: Set<string>): void {
  if (typeof document === 'undefined') return;

  const initialDataEl = document.getElementById('__INITIAL_DATA__');
  if (!initialDataEl?.textContent) return;

  try {
    const initial = JSON.parse(initialDataEl.textContent) as Record<string, unknown>;
    const list = Array.isArray(initial.microfrontends) ? initial.microfrontends : [];
    if (!Array.isArray(list)) return;

    initial.microfrontends = list.filter((raw) => {
      const normalized = normalizeMfName(raw);
      if (!normalized) return false;
      return allowed.has(normalized);
    });

    initialDataEl.textContent = JSON.stringify(initial);
  } catch {
    // Keep boot resilient.
  }
}

function filterImportMapMicrofrontends(allowed: Set<string>): void {
  if (typeof document === 'undefined') return;

  const importMapScript = document.querySelector<HTMLScriptElement>('script[type="importmap"]');
  if (!importMapScript?.textContent) return;

  try {
    const parsed = JSON.parse(importMapScript.textContent) as {
      imports?: Record<string, string>;
    };
    const imports = parsed.imports ?? {};
    const nextImports: Record<string, string> = {};

    for (const [key, value] of Object.entries(imports)) {
      if (!key.startsWith('mf-')) {
        nextImports[key] = value;
        continue;
      }
      if (allowed.has(key)) {
        nextImports[key] = value;
      }
    }

    importMapScript.textContent = JSON.stringify({ ...parsed, imports: nextImports });
  } catch {
    // Keep boot resilient.
  }
}

export function prepareModulesFilterBootstrap(): Promise<void> {
  if (preparePromise) return preparePromise;
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve();
  }

  preparePromise = (async () => {
    const auth = resolveAuthenticatedUserId();
    if (!auth) return;

    const allowedProtected = await fetchAllowedMicrofrontends(auth.userId, auth.token);
    const allowed = new Set<string>(SYSTEM_MICROFRONTENDS);
    if (allowedProtected) {
      for (const name of allowedProtected) allowed.add(name);
    }

    filterInitialMicrofrontends(allowed);
    filterImportMapMicrofrontends(allowed);
  })();

  return preparePromise;
}
