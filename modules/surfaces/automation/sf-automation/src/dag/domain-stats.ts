import { createDomain, sample } from "effector";
import { createDomainLogger } from "front-core";
import type { DagStats } from "g-dag";
import dagService from "./service";

const domain = createDomain("dag");
createDomainLogger(domain);

export default domain;

const EMPTY: DagStats = {
	executions: { total: 0, running: 0, done: 0, failed: 0 },
	daily: [],
	byWorkflow: {},
};

export const statsViewMounted = domain.createEvent("STATS_VIEW_MOUNTED");
export const refreshStatsClicked = domain.createEvent("REFRESH_STATS_CLICKED");

const loadStatsFx = domain.createEffect<void, DagStats>({
	name: "LOAD_STATS",
	handler: () => dagService.stats(),
});

export const $dagStats = domain
	.createStore<DagStats>(EMPTY)
	.on(loadStatsFx.doneData, (_, stats) => stats ?? EMPTY);

sample({ clock: [statsViewMounted, refreshStatsClicked], target: loadStatsFx });
