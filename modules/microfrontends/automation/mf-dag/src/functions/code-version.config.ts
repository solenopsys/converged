import dagClient from "../service";
import VersionsView from "../views/VersionsView";import { CreateAction, CreateWidget, StatCard } from "front-core";
import {  sample } from "effector";
import  domain  from "../domain";
import { createDataFlow } from "src/helpers";

const SHOW_VERSIONS = "show_versions";
const GET_VERSIONS = "get_versions";

const getCodeVersionsFx =domain.createEffect<{ page: number; after: string }, any>(async ({ page, after }) => {
    return await dagClient.getVersions(page, after);
});

const getVersionsEvent =domain.createEvent<{ page?: number; after?: string }>();
const versionsStore = domain.createStore(null);

sample({ clock: getVersionsEvent, target: getCodeVersionsFx });

versionsStore.on(getCodeVersionsFx.doneData, (_, data) => data);

sample({
    clock: getVersionsEvent,
    source: versionsStore,
    fn: (versions, params) => ({

        data: versions
    }),
});

const createCodeVersionsWidget: CreateWidget<typeof VersionsView> = () => ({
    view: VersionsView,
    placement: () => "center",
    mount: ({ page, after }) => getVersionsEvent({ page, after }),
    commands: {
        response: () => {
        }
    }
});

const createShowCodeVersionsAction: CreateAction<any> = (bus) => ({
    id: SHOW_VERSIONS,
    invoke: () => {
        bus.present({ widget: createCodeVersionsWidget(bus) });
    }
});

const createGetCodeVersionsAction: CreateAction<any> = (bus) => ({
    id: GET_VERSIONS,
    invoke: (params) => getVersionsEvent({ ...params, bus })
});

export {
    SHOW_VERSIONS,
    GET_VERSIONS,
    createShowCodeVersionsAction,
    createGetCodeVersionsAction
};

const ACTIONS = [
    createShowCodeVersionsAction,
    createGetCodeVersionsAction
];

export default ACTIONS;
