import dagClient from "../service";
import {ListView} from "converged-core"; // Добавил недостающий импорт
import { CreateAction, CreateWidget, StatCard } from "converged-core"; 
import { sample } from "effector";
import domain from "../domain";
import { createDataFlow } from "src/helpers";

const SHOW_CODE_SOURCE_LIST = "show_code_source_list";
const GET_CODE_SOURCE_LIST = "get_code_source_list";

const codeSourceListFx =domain.createEffect<any, any>();
const openCodeSourceEvent =domain.createEvent<{ id: string }>();
const getCodeSourceListEvent =domain.createEvent<any>();

sample({ clock: getCodeSourceListEvent, target: codeSourceListFx });

export const getCodeSourceListRequest = createDataFlow(
    () => dagClient.codeSourceList(),
    (names) => names.map((name: string) => ({ id: name, title: name }))
);

const createCodeSourceListWidget: CreateWidget<typeof ListView> = () => ({
    view: ListView,
    placement: () => "center",
    mount: async () => {
        const data = await codeSourceListFx();
        console.log("CODE SOURCE LIST", data);
        return {
            items: data || [],
            title: "Исходные коды"
        }
    },
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
        bus.present(createCodeSourceListWidget(bus));
    }
});

const createGetCodeSourceListAction: CreateAction<any> = (bus) => ({
    id: GET_CODE_SOURCE_LIST,
    description: "Get code source list",
    invoke: (params) => getCodeSourceListRequest({ ...params, bus })
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
