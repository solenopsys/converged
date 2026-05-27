import { createDomain, sample } from "effector";
import { $registeredCommands, registry, runActionEvent } from "front-core";
import type { FunctionDef, FunctionSearchResult } from "g-functions";
import { functionsClient } from "./service";

const domain = createDomain("functions");

export const functionsMounted = domain.createEvent("FUNCTIONS_MOUNTED");
export const refreshClicked = domain.createEvent("REFRESH_CLICKED");
export const searchChanged = domain.createEvent<string>("SEARCH_CHANGED");
export const executeClicked = domain.createEvent<{ id: string; params?: any }>("EXECUTE_CLICKED");
export const registerLocalFunctionsRequested = domain.createEvent("REGISTER_LOCAL_FUNCTIONS");

export const $searchQuery = domain.createStore<string>("", { name: "SEARCH_QUERY" });
$searchQuery.on(searchChanged, (_, q) => q);

// Remote functions from ms-functions (back + front registered via API)
export const fetchFunctionsFx = domain.createEffect<void, FunctionDef[]>({
  name: "FETCH_FUNCTIONS",
  handler: () => functionsClient.listFunctions(),
});

export const searchFunctionsFx = domain.createEffect<string, FunctionSearchResult[]>({
  name: "SEARCH_FUNCTIONS",
  handler: (query) => functionsClient.searchFunctions(query, 20),
});

// Register currently loaded front functions into ms-functions
export const registerLocalFunctionsFx = domain.createEffect<void, void>({
  name: "REGISTER_LOCAL_FUNCTIONS",
  handler: async () => {
    const commands = $registeredCommands.getState();
    if (commands.length === 0) return;
    await functionsClient.registerFunctions(
      commands.map((cmd) => ({
        id: cmd.id,
        brief: cmd.brief ?? cmd.description,
        description: cmd.description,
        category: cmd.category,
        type: "front" as const,
      })),
    );
  },
});

export const $remoteFunctions = domain.createStore<FunctionDef[]>([], { name: "REMOTE_FUNCTIONS" });
export const $searchResults = domain.createStore<FunctionSearchResult[] | null>(null, { name: "SEARCH_RESULTS" });
export const $isSearching = searchFunctionsFx.pending;
export const $isLoading = fetchFunctionsFx.pending;

$remoteFunctions.on(fetchFunctionsFx.doneData, (_, fns) => fns);
$searchResults
  .on(searchFunctionsFx.doneData, (_, results) => results)
  .on(searchChanged, (_, q) => (q.trim() === "" ? null : undefined));

sample({ clock: functionsMounted, target: [fetchFunctionsFx, registerLocalFunctionsFx] });
sample({ clock: refreshClicked, target: [fetchFunctionsFx, registerLocalFunctionsFx] });
sample({
  clock: $searchQuery,
  filter: (q) => q.trim().length >= 2,
  target: searchFunctionsFx,
});

const executeCommandFx = domain.createEffect<{ id: string; params?: any }, void>({
  name: "EXECUTE_COMMAND",
  handler: ({ id, params }) => {
    runActionEvent({ actionId: id, params: params ?? {} });
  },
});

sample({ clock: executeClicked, target: executeCommandFx });

export { $registeredCommands };
