
import { createDomain, sample } from "effector";
import { Action } from "../plugin/types_actions";
import { Widget } from "@/plugin";

import { createDomainLogger } from "../utils/logger";
import {present} from "../slots/present";

import { ActionRegistryImpl } from "./registry";
const domain = createDomain("bus");
createDomainLogger(domain);
export const registry = new ActionRegistryImpl();


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
}}
   
)
sample({
    clock: registerActionEvent,
    target: registerActionEffect
})



export const presentEvent = domain.createEvent<{widget:Widget<any>,params?:any}>("PRESENT");
export const presentEffect = domain.createEffect({name: "PRESENT_EFFECT", handler: ({widget,params}) => {
    present(widget,widget.placement({}),params);
}})

sample({
    clock: presentEvent,
    target: presentEffect
})



