const AUTH_TOKEN_KEY = "authToken";

export type AuthTokenPayload = {
  sub: string;
  exp: number;
  iat: number;
  temporary?: boolean;
  perm?: string[];
};

function decodePayload(token: string): AuthTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const raw = JSON.parse(atob(padded));
    if (typeof raw?.sub !== "string" || typeof raw?.exp !== "number") return null;
    return raw as AuthTokenPayload;
  } catch {
    return null;
  }
}

export const authToken = {
  get(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(AUTH_TOKEN_KEY);
  },

  payload(): AuthTokenPayload | null {
    const token = this.get();
    return token ? decodePayload(token) : null;
  },

  isAuthenticated(): boolean {
    const p = this.payload();
    if (!p) return false;
    if (p.temporary === true) return false;
    if (p.sub.startsWith("temp:")) return false;
    if (p.exp * 1000 < Date.now()) return false;
    return true;
  },
};
