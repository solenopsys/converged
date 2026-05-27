import type { CreateAction, CreateWidget } from "front-core";
import { FunctionsListView } from "./views/FunctionsListView";

const SHOW_FUNCTIONS = "functions.show";

const createFunctionsWidget: CreateWidget<typeof FunctionsListView> = (bus) => ({
  view: FunctionsListView,
  placement: () => "center",
  config: { bus },
});

const createShowFunctionsAction: CreateAction<any> = (bus) => ({
  id: SHOW_FUNCTIONS,
  brief: "Open functions/commands registry",
  category: "system",
  description: "Show all registered front and back functions",
  invoke: () => {
    bus.present({ widget: createFunctionsWidget(bus) });
  },
});

export { SHOW_FUNCTIONS, createShowFunctionsAction };
export default [createShowFunctionsAction];
