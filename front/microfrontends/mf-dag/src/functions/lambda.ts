import dagClient from "../service";
import { NodeConfigForm } from "../views/NodeConfigForm";
import { CreateAction, CreateWidget } from "front-core";
import { sample } from "effector";
import domain from "../domain";

const SHOW_LAMBDA = "show_lambda";

const lambdaFx = domain.createEffect<{ name: string }, any>(async ({ name }) => {
    const hash = await dagClient.getNode(name);
    console.log("HASH", hash);
    return { hash };
});

const showLambdaEvent = domain.createEvent<{ name: string }>();

sample({ clock: showLambdaEvent, target: lambdaFx });

const createLambdaWidget: CreateWidget<typeof NodeConfigForm> = () => ({
    view: NodeConfigForm,
    placement: () => "sidebar:tab:dag",
    config: {},
    commands: {
        onSave: () => {},
        onCancel: () => {}
    }
});

const createShowLambdaAction: CreateAction<any> = (bus) => ({
    id: SHOW_LAMBDA,
    description: "Show lambda",
    invoke: () => {
        bus.present({ widget: createLambdaWidget(bus) });
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
