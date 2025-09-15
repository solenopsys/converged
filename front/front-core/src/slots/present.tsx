import { Widget } from "@/types_actions";
import { mountWhenReady } from ".";

export const present = async (widget: Widget, slot: string) => {
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
 

    console.log("Present RUN", widget, slot, point);

    const Component = widget.view;
    const res = {...await widget.mount(), ...widget.config};
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
        <Component {...res} {...commandHandlers} />,
        point
    );
}