import { createDomain, sample } from "effector";
import { $registeredCommands, actionCommand, registry } from "front-core";

const domain = createDomain("commands");

export const commandsViewMounted = domain.createEvent("COMMANDS_VIEW_MOUNTED");
export const refreshCommandsClicked = domain.createEvent("REFRESH_COMMANDS_CLICKED");
export const executeCommandClicked = domain.createEvent<{ commandId: string; params?: any }>("EXECUTE_COMMAND_CLICKED");

export const $commandsFilter = domain.createStore<string>("", { name: "COMMANDS_FILTER" });
export const setCommandsFilter = domain.createEvent<string>("SET_COMMANDS_FILTER");
$commandsFilter.on(setCommandsFilter, (_, filter) => filter);

export const $filteredCommands = $registeredCommands.map((commands) => commands);

export const executeCommandFx = domain.createEffect<{ commandId: string; params?: any }, void>({
  name: "EXECUTE_COMMAND",
  handler: async ({ commandId, params }) => {
    await actionCommand({ actionId: commandId, params: params || {}, source: "user" });
  },
});

sample({
  clock: executeCommandClicked,
  target: executeCommandFx,
});

export { $registeredCommands };

export const getCommandIds = (): string[] => {
  return registry.getAllIds();
};

export const getCommandDescription = (commandId: string): string | undefined => {
  const action = registry.get(commandId);
  return action?.description;
};
