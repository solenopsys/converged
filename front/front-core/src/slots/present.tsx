import { Widget } from "@/plugin/types_actions";
import { mountWhenReady } from ".";

export const present = async (widget: Widget, slot: string, mountParams?: any) => {
    let point = "global:toast";
    if (slot === 'full') {
        point = "global:toast";
    }
    if (slot === 'center') {
        point = "sidebar:center";
    }

    if (slot === 'left') {
        point = "sidebar:left";
    }
    if (slot === 'right') {
        point = "sidebar:right";
    }
 

    console.log("Present RUN", widget, slot, point);

    const Component = widget.view;
    const res = {...await widget.mount(mountParams), ...widget.config};
    console.log("Mount result:", res);

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
        <Component {...res} {...commandHandlers}   />,
        point
    );
}