import { sample } from "effector";
import { type CreateAction, type CreateWidget, StatCard } from "front-core";
import { createDataFlow } from "src/helpers";
import domain from "../domain";
import dagClient from "../service";
import VersionsView from "../views/VersionsView";

const SHOW_VERSIONS = "show_versions";
const GET_VERSIONS = "get_versions";

const getCodeVersionsFx = domain.createEffect<
	{ page: number; after: string },
	any
>(async ({ page, after }) => {
	return await dagClient.getVersions(page, after);
});

const getVersionsEvent = domain.createEvent<{
	page?: number;
	after?: string;
}>();
const versionsStore = domain.createStore(null);

sample({ clock: getVersionsEvent, target: getCodeVersionsFx });

versionsStore.on(getCodeVersionsFx.doneData, (_, data) => data);

sample({
	clock: getVersionsEvent,
	source: versionsStore,
	fn: (versions, params) => ({
		data: versions,
	}),
});

const createCodeVersionsWidget: CreateWidget<typeof VersionsView> = () => ({
	view: VersionsView,
	placement: () => "center",
	mount: ({ page, after }) => getVersionsEvent({ page, after }),
	commands: {
		response: () => {},
	},
});

const createShowCodeVersionsAction: CreateAction<any> = (bus) => ({
	id: SHOW_VERSIONS,
	invoke: () => {
		bus.present({ widget: createCodeVersionsWidget(bus) });
	},
});

const createGetCodeVersionsAction: CreateAction<any> = (bus) => ({
	id: GET_VERSIONS,
	invoke: (params) => getVersionsEvent({ ...params, bus }),
});

export {
	createGetCodeVersionsAction,
	createShowCodeVersionsAction,
	GET_VERSIONS,
	SHOW_VERSIONS,
};

const ACTIONS = [createShowCodeVersionsAction, createGetCodeVersionsAction];

export default ACTIONS;
