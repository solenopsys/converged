import { sample } from 'effector';
import domain from './domain';
import dagService from './service';

type DagStats = {
  total: number;
  running: number;
  done: number;
  failed: number;
};

export const statsViewMounted = domain.createEvent('STATS_VIEW_MOUNTED');
export const refreshStatsClicked = domain.createEvent('REFRESH_STATS_CLICKED');

const loadStatsFx = domain.createEffect<void, DagStats>({
  name: 'LOAD_STATS',
  handler: async () => {
    return await dagService.getStats();
  },
});

export const $dagStats = domain.createStore<DagStats>({
  total: 0,
  running: 0,
  done: 0,
  failed: 0,
}).on(loadStatsFx.doneData, (_, stats) => stats);

sample({
  clock: statsViewMounted,
  target: loadStatsFx,
});

sample({
  clock: refreshStatsClicked,
  target: loadStatsFx,
});
