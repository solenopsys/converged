import { createStore, createEvent, createEffect, sample } from "effector";
import { threadsClient } from "g-threads";
import type { ThreadStats } from "g-threads";

export const threadsStatsViewMounted = createEvent();
export const refreshThreadsStatsClicked = createEvent();

export const fetchThreadsStatsFx = createEffect(async () => {
  return threadsClient.getThreadStats();
});

export const $threadsStats = createStore<ThreadStats>({
  total: 0,
  totalMessages: 0,
  byKind: { chat: 0, audio: 0, forum: 0, comment: 0 },
}).on(fetchThreadsStatsFx.doneData, (_, stats) => stats);

sample({
  clock: [threadsStatsViewMounted, refreshThreadsStatsClicked],
  target: fetchThreadsStatsFx,
});
