import { createDomain, sample } from "effector";
import { $registeredCommands, registry, runActionEvent } from "front-core";
import type { Action } from "front-core";

const domain = createDomain("commands");

// События
export const commandsViewMounted = domain.createEvent("COMMANDS_VIEW_MOUNTED");
export const refreshCommandsClicked = domain.createEvent("REFRESH_COMMANDS_CLICKED");
export const executeCommandClicked = domain.createEvent<{ commandId: string; params?: any }>("EXECUTE_COMMAND_CLICKED");

// Store для фильтрации/поиска команд
export const $commandsFilter = domain.createStore<string>("", { name: "COMMANDS_FILTER" });
export const setCommandsFilter = domain.createEvent<string>("SET_COMMANDS_FILTER");
$commandsFilter.on(setCommandsFilter, (_, filter) => filter);

// Производный store с отфильтрованными командами
export const $filteredCommands = $registeredCommands.map((commands) => commands);

// Эффект выполнения команды
export const executeCommandFx = domain.createEffect<{ commandId: string; params?: any }, void>({
  name: "EXECUTE_COMMAND",
  handler: ({ commandId, params }) => {
    console.log("[Commands] Executing command:", commandId, params);
    runActionEvent({ actionId: commandId, params: params || {} });
  },
});

sample({
  clock: executeCommandClicked,
  target: executeCommandFx,
});

// Экспортируем store команд для использования в других модулях
export { $registeredCommands };

// Функция для получения списка всех ID команд (для AI tool)
export const getCommandIds = (): string[] => {
  return registry.getAllIds();
};

// Функция для получения описания команды
export const getCommandDescription = (commandId: string): string | undefined => {
  const action = registry.get(commandId);
  return action?.description;
};
