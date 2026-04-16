import { createDomain, sample } from "effector";
import { createInfiniteTableStore } from "front-core";
import scriptsService from "./service";
import type {
	PaginationParams,
	ScriptFile,
	ScriptListItem,
} from "./functions/types";

const domain = createDomain("scripts");

export const scriptsViewMounted = domain.createEvent("SCRIPTS_VIEW_MOUNTED");
export const refreshScriptsClicked = domain.createEvent(
	"REFRESH_SCRIPTS_CLICKED",
);
export const createScriptClicked = domain.createEvent<ScriptFile>();
export const openScriptClicked = domain.createEvent<ScriptListItem>();
export const scriptContentChanged = domain.createEvent<string>();
export const saveScriptClicked = domain.createEvent("SAVE_SCRIPT_CLICKED");
export const deleteScriptClicked = domain.createEvent("DELETE_SCRIPT_CLICKED");

export const $selectedScript = domain.createStore<ScriptFile | null>(null);

$selectedScript
	.on(scriptContentChanged, (script, content) =>
		script ? { ...script, content } : script,
	)
	.on(createScriptClicked, (_state, script) => script);

const listScriptsFx = domain.createEffect<PaginationParams, any>({
	name: "LIST_SCRIPTS",
	handler: async (params: PaginationParams) => {
		return await scriptsService.listScripts(params);
	},
});

const readScriptFx = domain.createEffect<string, ScriptFile>({
	name: "READ_SCRIPT",
	handler: async (path: string) => {
		return await scriptsService.readScript(path);
	},
});

const saveScriptFx = domain.createEffect<ScriptFile, string>({
	name: "SAVE_SCRIPT",
	handler: async (script: ScriptFile) => {
		return await scriptsService.saveScript(script);
	},
});

const deleteScriptFx = domain.createEffect<string, void>({
	name: "DELETE_SCRIPT",
	handler: async (path: string) => {
		await scriptsService.deleteScript(path);
	},
});

export const $scriptsStore = createInfiniteTableStore(domain, listScriptsFx);

$selectedScript.on(readScriptFx.doneData, (_state, script) => script);

sample({
	clock: scriptsViewMounted,
	fn: () => ({}),
	target: $scriptsStore.reset,
});

sample({
	clock: scriptsViewMounted,
	fn: () => ({}),
	target: $scriptsStore.loadMore,
});

sample({
	clock: refreshScriptsClicked,
	fn: () => ({}),
	target: $scriptsStore.reset,
});

sample({
	clock: refreshScriptsClicked,
	fn: () => ({}),
	target: $scriptsStore.loadMore,
});

sample({
	clock: openScriptClicked,
	fn: (item) => item.path,
	target: readScriptFx,
});

sample({
	source: $selectedScript,
	clock: saveScriptClicked,
	filter: (script): script is ScriptFile => Boolean(script),
	target: saveScriptFx,
});

sample({
	source: $selectedScript,
	clock: deleteScriptClicked,
	filter: (script): script is ScriptFile => Boolean(script),
	fn: (script) => script.path,
	target: deleteScriptFx,
});

sample({
	clock: [saveScriptFx.done, deleteScriptFx.done],
	fn: () => ({}),
	target: $scriptsStore.reset,
});

sample({
	clock: [saveScriptFx.done, deleteScriptFx.done],
	fn: () => ({}),
	target: $scriptsStore.loadMore,
});

export default domain;
