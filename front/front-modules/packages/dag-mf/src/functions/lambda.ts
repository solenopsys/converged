import dagClient from "../service";
import {NodeFormView} from "../views/NodeFormView"; // Добавил недостающий импорт
import { CreateAction, CreateWidget } from "converged-core"; 
import {  sample } from "effector";
import domain from "../domain";
import { createDataFlow } from "src/helpers";

const SHOW_LAMBDA = "show_lambda";

const lambdaFx =domain.createEffect<{ name: string }, any>(async ({ name }) => {
    const hash = await dagClient.getNode(name);
    console.log("HASH", hash);
    return { hash };
});

const showLambdaEvent =domain.createEvent<{ name: string }>();

sample({ clock: showLambdaEvent, target: lambdaFx });

const createLambdaWidget: CreateWidget<typeof NodeFormView> = () => ({
    view: NodeFormView,
    placement: () => "right",
    mount: async ({ name }) => { 
        const hash = await dagClient.getNode(name);
        console.log("HASH", hash);
        return { hash };
    },
    commands: {
        response: () => {
            // Handle response command
        }
    }
});

const createShowLambdaAction: CreateAction<any> = (bus) => ({
    id: SHOW_LAMBDA,
    description: "Show lambda",
    invoke: () => {
        bus.present(createLambdaWidget(bus));
    }
});

export {
    SHOW_LAMBDA,
    createShowLambdaAction,
    showLambdaEvent
};

const ACTIONS = [
    createShowLambdaAction
];

export default ACTIONS;
