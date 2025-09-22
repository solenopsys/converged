import dagClient from "../service";
import { ListView } from "converged-core";
import { CreateAction, CreateWidget } from "converged-core";
import { sample } from "effector";
import domain from "../domain";

const SHOW_PROVIDERS_LIST = "show_providers_list";
const GET_PROVIDERS_LIST = "get_providers_list";

const $providersStore = domain.createStore<{ id: string, title: string }[]>([]);
const openProviderEvent = domain.createEvent<{ id: string }>("OPEN_PROVIDER");
const getProvidersListEvent = domain.createEvent<any>("GET_PROVIDERS_LIST");

export const providerListFx = domain.createEffect({
    name: "PROVIDER_LIST",
    handler: () => dagClient.providerList() // возвращает массив строк    
});

sample({
    clock: getProvidersListEvent,          // когда срабатывает запрос
    filter: $providersStore.map(items => items.length === 0),
    target: providerListFx,       // запускаем эффект
});

sample({
    clock: providerListFx.doneData,
    fn: (data) => {
        console.log('providerListFx result:', data); // проверьте структуру
        return data.names.map(name => ({ id: name, title: name }));
    }, 
    target: $providersStore,
});

const createProvidersListWidget: CreateWidget<typeof ListView> = () => ({
    view: ListView,
    config: {
        $items: $providersStore,
        title: "Providers"
    },
    placement: () => "center",
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
        getProvidersListEvent();
        bus.present({ widget: createProvidersListWidget(bus) });
    }
});

const createGetProvidersListAction: CreateAction<any> = (bus) => ({ // tut nuzhno kuda vozvrashchat'
    id: GET_PROVIDERS_LIST,
    description: "Get providers list",
    invoke: (params) => {
        getProvidersListEvent({ ...params, bus });
        //  bus.respond(resolveStore($providersStore),params.id);
    }
});

export {
    SHOW_PROVIDERS_LIST,
    GET_PROVIDERS_LIST,
    createShowProvidersListAction,
    createGetProvidersListAction
};

const ACTIONS = [
    createShowProvidersListAction,
    createGetProvidersListAction
];

export default ACTIONS;