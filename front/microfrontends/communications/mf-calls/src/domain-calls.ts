import { createDomain, sample } from "effector";
import { audioGateClient, type GateTranscriptItem } from "./services/audio-gate-client";

const domain = createDomain("calls");

// ── Events ─────────────────────────────────────────────────────────────────
export const sessionsListMounted = domain.createEvent("SESSIONS_LIST_MOUNTED");
export const refreshSessionsClicked = domain.createEvent("REFRESH_SESSIONS_CLICKED");
export const openCallDetail = domain.createEvent<{ sessionId: string }>("OPEN_CALL_DETAIL");
export const closeCallDetail = domain.createEvent("CLOSE_CALL_DETAIL");
export const startNewCallClicked = domain.createEvent("START_NEW_CALL_CLICKED");
export const returnToListClicked = domain.createEvent("RETURN_TO_LIST");

// ── Effects ────────────────────────────────────────────────────────────────
export const loadSessionsFx = domain.createEffect({
  name: "LOAD_SESSIONS",
  handler: (): Promise<string[]> => audioGateClient.listSessions(),
});

export const loadTranscriptFx = domain.createEffect({
  name: "LOAD_TRANSCRIPT",
  handler: async (sessionId: string): Promise<{ sessionId: string; items: GateTranscriptItem[] }> => ({
    sessionId,
    items: await audioGateClient.getTranscript(sessionId),
  }),
});

// ── Stores ─────────────────────────────────────────────────────────────────
/** All session IDs, newest first */
export const $sessions = domain
  .createStore<string[]>([])
  .on(loadSessionsFx.doneData, (_, ids) => [...ids].reverse());

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

export default domain;
