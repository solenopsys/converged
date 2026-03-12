import { createDomain, sample } from "effector";
import shedullerService from "./service";
import type { ShedullerStats } from "g-sheduller";

const domain = createDomain("sheduller-stats");

export const statsViewMounted = domain.createEvent("STATS_VIEW_MOUNTED");
export const refreshStatsClicked = domain.createEvent("REFRESH_STATS_CLICKED");

const getStatsFx = domain.createEffect<void, ShedullerStats>({
  name: "GET_STATS",
  handler: async () => {
    return await shedullerService.getStats();
  },
});

export const $stats = domain.createStore<ShedullerStats>({ crons: 0, history: 0 });

$stats.on(getStatsFx.doneData, (_state, stats) => stats);

sample({
  clock: statsViewMounted,
  target: getStatsFx,
});

sample({
  clock: refreshStatsClicked,
  target: getStatsFx,
});

export default domain;
