/**
 * HTTP client for the resonus REST API.
 * All calls go through the backend proxy at /audio-gate/*
 */

export type GateTranscriptItem = {
  time: number;
  source: "user" | "assistant";
  text: string;
};

type SessionsResp = { ok: boolean; sessions: string[] };
type ContextResp = { ok: boolean; key: string; context: string };

const BASE = "/audio-gate";

function buildWsUrl(path: string, query?: Record<string, string>): string {
  const proto =
    typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = typeof window !== "undefined" ? window.location.host : "localhost";
  const qs = query && Object.keys(query).length > 0
    ? "?" + new URLSearchParams(query).toString()
    : "";
  return `${proto}//${host}${BASE}${path}${qs}`;
}

export const audioGateClient = {
  /** WebSocket URL for WebRTC signaling. Routed through backend proxy. */
  wsCallUrl(user?: string, contextName?: string, scope?: string): string {
    const query: Record<string, string> = {};
    if (user) query.user = user;
    if (contextName) query.context_name = contextName;
    if (scope) query.scope = scope;
    return buildWsUrl("/ws", Object.keys(query).length > 0 ? query : undefined);
  },

  /** Direct URL for streaming a recorded WebM audio file. */
  recordingUrl(sessionId: string, source: "user" | "assistant"): string {
    return `${BASE}/record/${encodeURIComponent(sessionId)}/${source}`;
  },

  /** List all session IDs known to the gate. */
  async listSessions(): Promise<string[]> {
    try {
      const r = await fetch(`${BASE}/sessions`);
      if (!r.ok) return [];
      const d = (await r.json()) as SessionsResp;
      return d.sessions ?? [];
    } catch {
      return [];
    }
  },

  /** Get stored AI context string for a phone/key. */
  async getContext(key: string): Promise<string | null> {
    try {
      const r = await fetch(`${BASE}/context/${encodeURIComponent(key)}`);
      if (r.status === 404 || r.status === 503) return null;
      if (!r.ok) return null;
      const d = (await r.json()) as ContextResp;
      return d.context ?? null;
    } catch {
      return null;
    }
  },

  /** Persist AI context instructions for a phone/key. */
  async setContext(key: string, context: string): Promise<void> {
    await fetch(`${BASE}/context/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ context }),
    });
  },

  /** Delete AI context for a phone/key. */
  async deleteContext(key: string): Promise<void> {
    await fetch(`${BASE}/context/${encodeURIComponent(key)}`, { method: "DELETE" });
  },

  /** Health check. Returns true if gate is reachable. */
  async isHealthy(): Promise<boolean> {
    try {
      const r = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(3000) });
      return r.ok;
    } catch {
      return false;
    }
  },
};
