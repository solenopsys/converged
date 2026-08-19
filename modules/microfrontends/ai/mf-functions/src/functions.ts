import type { CreateAction } from "front-core";
import { functionsOpened, searchChanged } from "./domain";

const SHOW_FUNCTIONS = "functions.show";


const createShowFunctionsAction: CreateAction<{ query?: string } | undefined> = () => ({
  id: SHOW_FUNCTIONS,
  brief: "Open the catalog of callable functions",
  category: "functions",
  description:
    "Show every registered function — front (microfrontend commands) and back " +
    "(microservice methods) — with search by meaning. Optional argument: query.",
  invoke: (params) => {
    const query = params?.query?.trim();
    if (query) searchChanged(query);
    functionsOpened();
    return { ok: true, entity: "functions", query: query ?? null };
  },
});

export { SHOW_FUNCTIONS, createShowFunctionsAction };
export default [createShowFunctionsAction];
