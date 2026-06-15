import { CreateAction, CreateWidget } from "front-core";
import { ContextsListView } from "./views/ContextsListView";

// ── Action IDs ───────────────────────────────────────────────────────────────
export const SHOW_CONTEXTS = "contexts.show";

// ── Widget factories ─────────────────────────────────────────────────────────
const createContextsListWidget: CreateWidget<typeof ContextsListView> = (bus) => ({
  view: ContextsListView,
  placement: () => "center",
  config: { bus },
});

// ── Action creators ──────────────────────────────────────────────────────────
const createShowContextsAction: CreateAction<any> = (bus) => ({
  id: SHOW_CONTEXTS,
  description: "Show contexts list",
  invoke: () => {
    bus.present({ widget: createContextsListWidget(bus) });
  },
});

const ACTIONS = [createShowContextsAction];

export { createShowContextsAction };

export default ACTIONS;
