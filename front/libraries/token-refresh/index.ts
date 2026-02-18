export type JwtPayload = {
  sub?: string;
  exp?: number;
  iat?: number;
  perm?: string[];
  [key: string]: any;
};

export type TokenPair = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
};

export interface TokenStorage {
  get(): TokenPair | null;
  set(tokens: TokenPair | null): void;
}

export type TokenRefreshFn = (
  refreshToken: string,
  current?: TokenPair | null,
) => Promise<TokenPair>;

export type TokenRefreshRequestConfig = {
  url: string;
  method?: "POST" | "PUT";
  headers?: Record<string, string>;
  bodyField?: string;
  mapResponse?: (data: any) => TokenPair;
  fetcher?: typeof fetch;
};

function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const anyGlobal = globalThis as any;
  if (typeof anyGlobal.atob === "function") {
    return anyGlobal.atob(padded);
  }
  if (typeof anyGlobal.Buffer !== "undefined") {
    return anyGlobal.Buffer.from(padded, "base64").toString("utf8");
  }
  throw new Error("No base64 decoder available");
}

export function decodeJwtPayload(token: string): JwtPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const json = decodeBase64Url(parts[1]);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export function getJwtExpiry(token: string): number | null {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") {
    return null;
  }
  return payload.exp;
}

export function createMemoryTokenStorage(initial?: TokenPair | null): TokenStorage {
  let current = initial ?? null;
  return {
    get() {
      return current;
    },
    set(tokens: TokenPair | null) {
      current = tokens ?? null;
    },
  };
}

export function createJsonTokenStorage(
  storage: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
  },
  key: string = "auth_tokens",
): TokenStorage {
  return {
    get() {
      const raw = storage.getItem(key);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as TokenPair;
      } catch {
        return null;
      }
    },
    set(tokens: TokenPair | null) {
      if (!tokens) {
        storage.removeItem(key);
        return;
      }
      storage.setItem(key, JSON.stringify(tokens));
    },
  };
}

export function createTokenRefreshRequest(
  config: TokenRefreshRequestConfig,
): TokenRefreshFn {
  const fetcher =
    config.fetcher ?? (globalThis as any).fetch ?? undefined;
  if (!fetcher) {
    throw new Error("No fetch implementation available");
  }
  const method = config.method ?? "POST";
  const bodyField = config.bodyField ?? "refreshToken";

  return async (refreshToken: string) => {
    const response = await fetcher(config.url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(config.headers ?? {}),
      },
      body: JSON.stringify({ [bodyField]: refreshToken }),
    });

    if (!response.ok) {
      throw new Error(`Refresh failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (config.mapResponse) {
      return config.mapResponse(data);
    }

    const accessToken = data.accessToken ?? data.token ?? data.access_token;
    const nextRefresh = data.refreshToken ?? data.refresh_token;
    const expiresAt = data.expiresAt ?? data.expires_at;

    if (!accessToken) {
      throw new Error("Refresh response missing access token");
    }

    return {
      accessToken,
      refreshToken: nextRefresh,
      expiresAt,
    } as TokenPair;
  };
}

export class TokenManager {
  private subscribers = new Set<() => void>();
  private refreshPromise?: Promise<TokenPair | null>;

  constructor(
    private storage: TokenStorage,
    private refreshFn?: TokenRefreshFn,
    private leewaySeconds: number = 30,
    private now: () => number = () => Date.now(),
  ) {}

  getTokens(): TokenPair | null {
    return this.storage.get();
  }

  setTokens(tokens: TokenPair | null): void {
    this.storage.set(tokens);
    this.notify();
  }

  clear(): void {
    this.setTokens(null);
  }

  getAccessToken(): string | null {
    const tokens = this.getTokens();
    return tokens?.accessToken ?? null;
  }

  isAccessTokenExpired(tokens?: TokenPair | null): boolean {
    const current = tokens ?? this.getTokens();
    if (!current?.accessToken) return true;
    const expiresAt =
      typeof current.expiresAt === "number"
        ? current.expiresAt
        : getJwtExpiry(current.accessToken);
    if (!expiresAt) return false;
    const nowSeconds = Math.floor(this.now() / 1000);
    return nowSeconds + this.leewaySeconds >= expiresAt;
  }

  async getValidAccessToken(): Promise<string | null> {
    const tokens = this.getTokens();
    if (!tokens?.accessToken) return null;

    if (!this.isAccessTokenExpired(tokens)) {
      return tokens.accessToken;
    }

    if (!tokens.refreshToken || !this.refreshFn) {
      return tokens.accessToken;
    }

    const refreshed = await this.refresh();
    return refreshed?.accessToken ?? null;
  }

  async refresh(): Promise<TokenPair | null> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }
    const tokens = this.getTokens();
    if (!tokens?.refreshToken || !this.refreshFn) {
      return null;
    }
    this.refreshPromise = this.refreshFn(tokens.refreshToken, tokens)
      .then((next) => {
        this.setTokens({
          accessToken: next.accessToken,
          refreshToken: next.refreshToken ?? tokens.refreshToken,
          expiresAt: next.expiresAt,
        });
        return this.getTokens();
      })
      .catch((error) => {
        this.refreshPromise = undefined;
        throw error;
      })
      .finally(() => {
        this.refreshPromise = undefined;
      });
    return this.refreshPromise;
  }

  bindHeaders(
    headers: Record<string, string>,
    headerName: string = "Authorization",
  ): () => void {
    const update = () => {
      const token = this.getAccessToken();
      if (token) {
        headers[headerName] = `Bearer ${token}`;
      } else {
        delete headers[headerName];
      }
    };

    update();
    this.subscribers.add(update);
    return () => {
      this.subscribers.delete(update);
    };
  }

  private notify() {
    for (const subscriber of this.subscribers) {
      subscriber();
    }
  }
}
