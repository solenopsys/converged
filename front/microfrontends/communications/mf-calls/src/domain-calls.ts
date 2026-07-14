import { createDomain, sample } from "effector";
import { callsClient } from "g-calls";
import {
  type GateTranscriptItem,
  readCallTranscript,
} from "./services/call-transcript";

const domain = createDomain("calls");

// ── Events ─────────────────────────────────────────────────────────────────
export const sessionsListMounted = domain.createEvent("SESSIONS_LIST_MOUNTED");
export const refreshSessionsClicked = domain.createEvent("REFRESH_SESSIONS_CLICKED");
export const sessionMetaRequested = domain.createEvent<string>("SESSION_META_REQUESTED");
export const openCallDetail = domain.createEvent<{ sessionId: string }>("OPEN_CALL_DETAIL");
export const closeCallDetail = domain.createEvent("CLOSE_CALL_DETAIL");
export const startNewCallClicked = domain.createEvent("START_NEW_CALL_CLICKED");
export const returnToListClicked = domain.createEvent("RETURN_TO_LIST");

// ── Effects ────────────────────────────────────────────────────────────────
export const loadSessionsFx = domain.createEffect({
  name: "LOAD_SESSIONS",
  // ms-calls is the scoped source of truth for persisted call sessions.
  handler: async (): Promise<string[]> => {
    const res = await callsClient.listCalls({ offset: 0, limit: 200 });
    return res.items.map((c) => c.id);
  },
});

export const loadTranscriptFx = domain.createEffect({
  name: "LOAD_TRANSCRIPT",
  handler: async (sessionId: string): Promise<{ sessionId: string; items: GateTranscriptItem[] }> => ({
    sessionId,
    items: await readCallTranscript(sessionId),
  }),
});

/** Per-session metadata (line count, availability, created time) shown in the list table. */
export type SessionMeta = {
  id: string;
  lines: number;
  hasTranscript: boolean;
  hasAudio: boolean;
  createdAt: number | null;
};

/** Decode the millisecond timestamp from the leading 10 chars of a ULID. */
function decodeUlidTime(id: string): number | null {
  const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  if (id.length < 10) return null;
  let ms = 0;
  for (let i = 0; i < 10; i++) {
    const idx = ALPHABET.indexOf(id[i].toUpperCase());
    if (idx === -1) return null;
    ms = ms * 32 + idx;
  }
  return ms;
}

export const loadSessionMetaFx = domain.createEffect({
  name: "LOAD_SESSION_META",
  handler: async (id: string): Promise<SessionMeta> => {
    // Audio presence comes from ms-calls (which owns the stored Opus frames),
    // not the gate. hasCallAudio is a cheap key-count — no muxing/download.
    const [items, hasAudio] = await Promise.all([
      readCallTranscript(id).catch(() => []),
      callsClient.hasCallAudio(id).catch(() => false),
    ]);
    const createdAt = items[0]?.time ? items[0].time * 1000 : decodeUlidTime(id);
    return {
      id,
      lines: items.length,
      hasTranscript: items.length > 0,
      hasAudio,
      createdAt,
    };
  },
});

// ── Stores ─────────────────────────────────────────────────────────────────
/** All session IDs, newest first */
export const $sessions = domain
  .createStore<string[]>([])
  // ms-calls already returns newest-first; keep its order.
  .on(loadSessionsFx.doneData, (_, ids) => ids);

export const $sessionsLoading = domain
  .createStore(false)
  .on(loadSessionsFx, () => true)
  .on(loadSessionsFx.finally, () => false);

/** Which session is currently open in detail view */
export const $selectedSessionId = domain
  .createStore<string | null>(null)
  .on(openCallDetail, (_, { sessionId }) => sessionId)
  .on(closeCallDetail, () => null)
  .on(returnToListClicked, () => null);

/** Per-session metadata cache keyed by sessionId, populated lazily as rows mount */
export const $sessionMeta = domain
  .createStore<Record<string, SessionMeta>>({})
  .on(loadSessionMetaFx.doneData, (state, meta) => ({ ...state, [meta.id]: meta }))
  // Drop cached meta on refresh so rows re-check availability
  .reset(refreshSessionsClicked);

/** Cached transcripts keyed by sessionId */
export const $transcripts = domain
  .createStore<Record<string, GateTranscriptItem[]>>({})
  .on(loadTranscriptFx.doneData, (state, { sessionId, items }) => ({
    ...state,
    [sessionId]: items,
  }));

/** Whether the active-call panel is shown */
export const $showActiveCall = domain
  .createStore(false)
  .on(startNewCallClicked, () => true)
  .on(returnToListClicked, () => false)
  .on(closeCallDetail, () => false);

// ── Wiring ─────────────────────────────────────────────────────────────────
sample({ clock: sessionsListMounted, target: loadSessionsFx });
sample({ clock: refreshSessionsClicked, target: loadSessionsFx });
sample({
  clock: openCallDetail,
  fn: ({ sessionId }) => sessionId,
  target: loadTranscriptFx,
});
// Reload list when returning from active call
sample({ clock: returnToListClicked, target: loadSessionsFx });
// Lazily load row metadata, skipping sessions already cached or in-flight
sample({
  source: $sessionMeta,
  clock: sessionMetaRequested,
  filter: (meta, id) => !(id in meta),
  fn: (_, id) => id,
  target: loadSessionMetaFx,
});

export default domain;
