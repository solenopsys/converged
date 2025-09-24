import { Widget } from "@/plugin/types_actions";
import { mountWhenReady } from ".";
import { dashboardSlots } from "./dashboard_slots";

function oneOf<T>(value: T, ...options: (T[] | T)[]) {
    return options.flat().includes(value);
}



export const present = async (widget: Widget<any>, slot: string | string[], mountParams?: any) => {
    let point = "global:toast";
    if (oneOf('full', slot)) {
        point = "global:toast";
    }
    if (oneOf('center', slot)) {
        point = "sidebar:center";
    }

    if (oneOf('left', slot)) {
        point = "sidebar:left";
    }
    if (oneOf('right', slot)) {
        point = "sidebar:right";
    }
    if (oneOf('dashboard', slot)) {
        point ="dashboard:"+ dashboardSlots.next("pinned-");
    }
 

    console.log("Present RUN", widget, slot, point);
    console.log("Present PARAMS", mountParams);

    const Component = widget.view;
    const res = {  ...widget.config}; 

    // Создаем обработчики команд
    const commandHandlers = {};
    if (widget.commands) {
        Object.keys(widget.commands).forEach(commandName => {
            commandHandlers[commandName] = (payload) => {
                // Вызываем команду из виджета
                widget.commands[commandName](payload);
            };
        });
    }

    console.log("Present RES", res);

    return mountWhenReady(
        <Component {...res} {...mountParams} {...commandHandlers}   />,
        point
    );
}