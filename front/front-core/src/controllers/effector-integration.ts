
import { createDomain, sample, createStore } from "effector";
import { Action } from "../plugin/types_actions";
import { Widget } from "@/plugin";

import { createDomainLogger } from "../../../libraries/effector-logger/logger";
import {present} from "../slots/present";

import { registry } from "./registry";
const domain = createDomain("bus");
createDomainLogger(domain);

// Store для отслеживания всех зарегистрированных команд
export const $registeredCommands = domain.createStore<Action<any>[]>([], { name: 'REGISTERED_COMMANDS' });


// run
export const runActionEvent = domain.createEvent<{ actionId: string, params: any }>("RUN_ACTION")
export const runActionEffect = domain.createEffect(
    ({actionId, params}: {actionId: string, params: any}) => {
        const action = registry.run(actionId, params);
    }
)
sample({
    clock: runActionEvent,
    target: runActionEffect
})

// register
export const registerActionEvent = domain.createEvent<Action<any>>("REGISTER_ACTION");
export const registerActionEffect = domain.createEffect({name:"REGISTER_EFFECT",handler: (action: Action<any>) => {
    registry.register(action);
    return action;
}}

)
sample({
    clock: registerActionEvent,
    target: registerActionEffect
})

// Обновляем store команд после регистрации
$registeredCommands.on(registerActionEffect.doneData, (state, action) => [...state, action]);



export const presentEvent = domain.createEvent<{widget:Widget<any>,params?:any}>("PRESENT");
export const presentEffect = domain.createEffect({name: "PRESENT_EFFECT", handler: ({widget,params}) => {
    console.log("[presentEffect] Called with widget:", widget);
    console.log("[presentEffect] Widget view:", widget.view);
    console.log("[presentEffect] Widget placement:", widget.placement);
    const placement = widget.placement({});
    console.log("[presentEffect] Placement result:", placement);
    return present(widget, placement, params);
}})

sample({
    clock: presentEvent,
    target: presentEffect
})
