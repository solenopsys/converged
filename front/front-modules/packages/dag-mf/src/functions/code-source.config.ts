import dagClient from "../service";
import { ListView } from "converged-core"; // Добавил недостающий импорт
import { CreateAction, CreateWidget, StatCard } from "converged-core";
import { sample } from "effector";
import domain from "../domain";

const SHOW_CODE_SOURCE_LIST = "show_code_source_list";
const GET_CODE_SOURCE_LIST = "get_code_source_list";

const $codeSourceStore = domain.createStore<{ id: string, title: string }[]>([]);
const openCodeSourceEvent = domain.createEvent<{ id: string }>("OPEN_CODE_SOURCE");
const getCodeSourceListEvent = domain.createEvent<any>("GET_CODE_SOURCE_LIST");

export const codeSourceListFx = domain.createEffect({
    name: "CODE_SOURCE_LIST",
    handler: () => dagClient.codeSourceList() // возвращает массив строк    
}
);

sample({
    clock: getCodeSourceListEvent,          // когда срабатывает запрос
    filter: $codeSourceStore.map(items => items.length === 0),
    target: codeSourceListFx,       // запускаем эффект
});

sample({
    clock: codeSourceListFx.doneData,
    fn: (data) => {
        console.log('codeSourceListFx result:', data); // проверьте структуру
        return data.names.map(name => ({ id: name, title: name }));
    }, target: $codeSourceStore,
});

const createCodeSourceListWidget: CreateWidget<typeof ListView> = () => ({
    view: ListView,
    config: {
        $items: $codeSourceStore,
        title: "Исходные коды"
    },
    placement: () => "center",
    commands: {
        onSelect: (id) => {
            console.log("SELECT", id);
            openCodeSourceEvent({ id });
        }
    }
});

const createShowCodeSourceListAction: CreateAction<any> = (bus) => ({
    id: SHOW_CODE_SOURCE_LIST,
    description: "Show code source list",
    invoke: () => {
        getCodeSourceListEvent()
        bus.present(createCodeSourceListWidget(bus));
    }
});

const createGetCodeSourceListAction: CreateAction<any> = (bus) => ({ // tут нужно куда возвращать
    id: GET_CODE_SOURCE_LIST,
    description: "Get code source list",
    invoke: (params) => {
        getCodeSourceListEvent({ ...params, bus })
        //  bus.respond(resolveStore($codeSourceStore),params.id);
    }
});

export {
    SHOW_CODE_SOURCE_LIST,
    GET_CODE_SOURCE_LIST,
    createShowCodeSourceListAction,
    createGetCodeSourceListAction
};

const ACTIONS = [
    createShowCodeSourceListAction,
    createGetCodeSourceListAction
];

export default ACTIONS;
