import { sample } from "effector";
import domain from "./domain";
import dagService from "./service";

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
