import { CreateAction, CreateWidget, ListView } from "converged-core";
import {  sample } from "effector";
import dagClient from "../service";
import { createDataFlow } from "../helpers";
import domain from "../domain";

const SHOW_PROVIDERS_LIST = "show_providers_list";
const GET_PROVIDERS_LIST = "get_providers_list";

const providerListFx =domain.createEffect<any, any>();
const openProviderEvent =domain.createEvent<{ id: string }>();
const getProvidersListEvent =domain.createEvent<any>();

sample({ clock: openProviderEvent, target: providerListFx });
sample({ clock: getProvidersListEvent, target: providerListFx });

export const getProvidersListRequest = createDataFlow(
    () => dagClient.providerList(),
    (names) => names.map((name: string) => ({ id: name, title: name }))
);

const createProvidersListWidget: CreateWidget<typeof ListView> = () => ({
    view: ListView,
    placement: () => "center",
    mount: async () => {
        const data = await providerListFx();
        console.log("PROVIDERS LIST", data);
        return {
            items: data || [],
            title: "Providers"
        }
    },
    commands: {
        onSelect: (id) => {
            console.log("SELECT", id);
            openProviderEvent({ id });
        }
    }
});

const createShowProvidersListAction: CreateAction<any> = (bus) => ({
    id: SHOW_PROVIDERS_LIST,
    description: "Show providers list",
    invoke: () => {
        bus.present(createProvidersListWidget(bus));
    }
});

const createGetProvidersListAction: CreateAction<any> = (bus) => ({
    id: GET_PROVIDERS_LIST,
    description: "Get providers list",
    invoke: (params) => getProvidersListRequest({ ...params, bus })
});

const ACTIONS = [
    createShowProvidersListAction,
    createGetProvidersListAction
];

export {
    SHOW_PROVIDERS_LIST,
    GET_PROVIDERS_LIST,
    createShowProvidersListAction,
    createGetProvidersListAction,  
};

export default ACTIONS;