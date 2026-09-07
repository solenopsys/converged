import { sample } from "effector";
import { createInfiniteTableStore } from "front-core";
import type { ExecutionTree, PaginationParams } from "g-dag";
import domain from "./domain-stats";
import dagService from "./service";

const listExecutionsFx = domain.createEffect<PaginationParams, any>({
	name: "LIST_EXECUTIONS",
	handler: (params) => dagService.listExecutions(params),
});

export const $executionsStore = createInfiniteTableStore(
	domain,
	listExecutionsFx,
);

// ---- the log of one run ----------------------------------------------------

export const openExecution = domain.createEvent<string>("OPEN_EXECUTION");
export const refreshExecution = domain.createEvent("REFRESH_EXECUTION");
export const nodeToggled = domain.createEvent<string>("NODE_TOGGLED");

const loadTreeFx = domain.createEffect<string, ExecutionTree>({
	name: "LOAD_EXECUTION_TREE",
	handler: (id) => dagService.executionTree(id),
});

export const $executionId = domain
	.createStore<string>("")
	.on(openExecution, (_, id) => id);

export const $executionTree = domain
	.createStore<ExecutionTree | null>(null)
	.on(loadTreeFx.doneData, (_, tree) => tree)
	.reset(openExecution);

export const $treeError = domain
	.createStore<string | null>(null)
	.on(loadTreeFx.failData, (_, error) => String(error?.message ?? error))
	.reset([openExecution, loadTreeFx.done]);

export const $treeLoading = loadTreeFx.pending;

/**
 * Which nodes have their input and result unfolded. Keyed by
 * `<executionId>:<seq>` because a delegated run repeats sequence numbers from
 * one, and two different nodes must not share one toggle.
 */
export const $expandedNodes = domain
	.createStore<Record<string, boolean>>({})
	.on(nodeToggled, (expanded, key) => ({
		...expanded,
		[key]: !expanded[key],
	}))
	.reset(openExecution);

sample({ clock: openExecution, target: loadTreeFx });

sample({
	source: $executionId,
	clock: refreshExecution,
	filter: (id) => Boolean(id),
	target: loadTreeFx,
});

/** A run that is still going gets its own refresh, so the log fills in live. */
sample({
	clock: loadTreeFx.doneData,
	filter: (tree) => tree?.execution?.status === "running",
	fn: () => undefined,
	target: domain.createEffect({
		name: "SCHEDULE_EXECUTION_REFRESH",
		handler: () =>
			new Promise<void>((resolve) => setTimeout(resolve, 2000)).then(() =>
				refreshExecution(),
			),
	}),
});
