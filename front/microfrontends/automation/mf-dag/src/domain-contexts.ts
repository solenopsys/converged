import { sample } from "effector";
import { createInfiniteTableStore } from "front-core";
import type { Execution, PaginationParams } from "g-dag";
import domain from "./domain";
import dagService from "./service";

const contextsDataFunction = async (params: PaginationParams) => {
	return await dagService.listExecutions(params);
};

export const $contextsStore = createInfiniteTableStore<Execution>(
	domain,
	contextsDataFunction,
);

export const refreshContextsClicked = $contextsStore.refresh;

// Детальный просмотр контекста
export const openContextDetail = domain.createEvent<{ contextId: string }>(
	"OPEN_CONTEXT_DETAIL",
);
export const $selectedContext = domain.createStore<any>(null);

const loadContextFx = domain.createEffect<string, any>({
	handler: (id) => dagService.statusExecution(id),
});

sample({
	clock: openContextDetail,
	fn: ({ contextId }) => contextId,
	target: loadContextFx,
});
sample({ clock: loadContextFx.doneData, target: $selectedContext });
