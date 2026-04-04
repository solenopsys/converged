import { sample } from 'effector';
import domain from './domain';
import dagService from './service';

type DagDailyStatsPoint = {
  date: string;
  total: number;
  running: number;
  done: number;
  failed: number;
};

type DagNodeDailyPoint = {
  date: string;
  total: number;
  failed: number;
};

type DagStats = {
  total: number;
  running: number;
  done: number;
  failed: number;
  tasksTotal: number;
  daily: DagDailyStatsPoint[];
  nodesDaily: DagNodeDailyPoint[];
  types: Record<string, number>;
};

export const statsViewMounted = domain.createEvent('STATS_VIEW_MOUNTED');
export const refreshStatsClicked = domain.createEvent('REFRESH_STATS_CLICKED');

const loadStatsFx = domain.createEffect<void, DagStats>({
  name: 'LOAD_STATS',
  handler: async () => {
    const result = await dagService.stats();
    return {
      total: Number(result?.executions?.total ?? 0),
      running: Number(result?.executions?.running ?? 0),
      done: Number(result?.executions?.done ?? 0),
      failed: Number(result?.executions?.failed ?? 0),
      tasksTotal: Number(result?.tasks?.total ?? 0),
      daily: Array.isArray(result?.executionsDaily)
        ? result.executionsDaily.map((item: any) => ({
            date: String(item?.date ?? ''),
            total: Number(item?.total ?? 0),
            running: Number(item?.running ?? 0),
            done: Number(item?.done ?? 0),
            failed: Number(item?.failed ?? 0),
          }))
        : [],
      nodesDaily: Array.isArray(result?.nodesDaily)
        ? result.nodesDaily.map((item: any) => ({
            date: String(item?.date ?? ''),
            total: Number(item?.total ?? 0),
            failed: Number(item?.failed ?? 0),
          }))
        : [],
      types:
        result?.executionsTypes && typeof result.executionsTypes === 'object'
          ? Object.entries(result.executionsTypes as Record<string, unknown>).reduce(
              (acc, [key, value]) => {
                acc[key] = Number(value ?? 0);
                return acc;
              },
              {} as Record<string, number>,
            )
          : {},
    };
  },
});

export const $dagStats = domain.createStore<DagStats>({
  total: 0,
  running: 0,
  done: 0,
  failed: 0,
  tasksTotal: 0,
  daily: [],
  nodesDaily: [],
  types: {},
}).on(loadStatsFx.doneData, (_, stats) => stats);

sample({
  clock: statsViewMounted,
  target: loadStatsFx,
});

sample({
  clock: refreshStatsClicked,
  target: loadStatsFx,
});
