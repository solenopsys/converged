import dagClient from "../service";
import ContextViewer from "../views/ContextView"; // Добавил недостающий импорт
import { CreateAction, CreateWidget, StatCard } from "converged-core"; 
import {  sample } from "effector";
import domain from "../domain";
import { createDataFlow } from "src/helpers";

const SHOW_CONTEXT = "show_context";

const contextFx =domain.createEffect<any, any>();
const showContextEvent =domain.createEvent<{ contextId: string }>();

sample({ clock: showContextEvent, target: contextFx });

const createContextWidget: CreateWidget<typeof ContextViewer> = () => ({
    view: ContextViewer,
    placement: () => "center",
    mount: () => { },
    commands: {
        response: () => {
            // Handle response command
        }
    }
});

const createShowContextAction: CreateAction<any> = (bus) => ({
    id: SHOW_CONTEXT,
    description: "Show context",
    invoke: () => {
        bus.present(createContextWidget(bus));
    }
});

export {
    SHOW_CONTEXT,
    createShowContextAction,
    showContextEvent
};


const ACTIONS = [
    createShowContextAction
];

export default ACTIONS;