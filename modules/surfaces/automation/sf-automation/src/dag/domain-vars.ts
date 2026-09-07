import { sample } from "effector";
import domain from "./domain-stats";
import dagService from "./service";

export const openVarForm = domain.createEvent<{
	variable: { key: string; value: any } | null;
}>("OPEN_VAR_FORM");
export const loadVarDetail = domain.createEvent<string>("LOAD_VAR_DETAIL");

export const $currentVar = domain.createStore<{
	key: string;
	value: any;
} | null>(null);

export const updateVarFx = domain.createEffect<
	{ key: string; value: any },
	void
>({
	handler: ({ key, value }) => dagService.setVar(key, value),
});

const loadVarDetailFx = domain.createEffect<
	string,
	{ key: string; value: any } | null
>({
	handler: async (key) => {
		const result = await dagService.listVariables({
			offset: 0,
			limit: 1,
			filter: { key: { eq: key } },
		});
		return result.items[0] ?? null;
	},
});

$currentVar.on(openVarForm, (_, { variable }) => variable);
$currentVar.reset(updateVarFx.done);

sample({ clock: loadVarDetail, target: loadVarDetailFx });
sample({
	clock: loadVarDetailFx.doneData,
	fn: (variable) => ({ variable }),
	target: openVarForm,
});
