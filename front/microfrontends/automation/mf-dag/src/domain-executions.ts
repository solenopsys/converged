import { createInfiniteTableStore } from "front-core";
import type { Execution, PaginationParams } from "g-dag";
import domain from "./domain";
import dagService from "./service";

const executionsDataFunction = async (params: PaginationParams) => {
	return await dagService.listExecutions(params);
};

export const $executionsStore = createInfiniteTableStore<Execution>(
	domain,
	executionsDataFunction,
);

export const refreshExecutionsClicked = $executionsStore.refresh;
