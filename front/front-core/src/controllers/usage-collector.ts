type UsageEventInput = {
  function: string;
  user: string;
  date?: string;
};

const FLUSH_DEBOUNCE_MS = 1200;
const RETRY_MS = 5000;
const MAX_BATCH_SIZE = 100;
const MAX_QUEUE_SIZE = 2000;

const SYSTEM_ACTION_PREFIXES = [
  "layout.",
  "left.menu.",
  "dashboard.",
  "chats.",
  "section.load.",
];

let queue: UsageEventInput[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushInProgress = false;

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function resolveUserId(): string {
  if (typeof window === "undefined") return "system";
  const token = window.localStorage.getItem("authToken");
  if (!token) return "guest";
  const payload = decodeJwtPayload(token);
  const candidates = [
    payload?.sub,
    payload?.user,
    payload?.email,
    payload?.preferred_username,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
    }
  }
  return "auth";
}

function shouldTrack(actionId: string): boolean {
  if (!actionId) return false;
  if (!actionId.includes(".")) return false;
  return !SYSTEM_ACTION_PREFIXES.some((prefix) => actionId.startsWith(prefix));
}

function scheduleFlush(delay = FLUSH_DEBOUNCE_MS): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    void flushNow();
  }, delay);
}

async function flushNow(): Promise<void> {
  if (flushInProgress || queue.length === 0) return;
  flushInProgress = true;

  try {
    while (queue.length > 0) {
      const batch = queue.splice(0, MAX_BATCH_SIZE);
      try {
        await fetch("/services/usage/recordUsage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ events: batch }),
        });
      } catch {
        queue = [...batch, ...queue];
        scheduleFlush(RETRY_MS);
        break;
      }
    }
  } finally {
    flushInProgress = false;
  }
}

export function trackActionUsage(actionId: string): void {
  if (typeof window === "undefined") return;
  if (!shouldTrack(actionId)) return;

  if (queue.length >= MAX_QUEUE_SIZE) {
    return;
  }

  queue.push({
    function: actionId,
    user: resolveUserId(),
    date: new Date().toISOString(),
  });

  scheduleFlush();
}

export function flushActionUsage(): Promise<void> {
  return flushNow();
}
