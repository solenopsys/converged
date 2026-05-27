import { CreateWidget, CreateAction } from "front-core";
import { HistoryView } from "../views/HistoryView";

const SHOW_HISTORY = "sheduller.history.show";

const createHistoryWidget: CreateWidget<typeof HistoryView> = (bus) => ({
  view: HistoryView,
  placement: () => "center",
  config: {
    bus,
  },
});

const createShowHistoryAction: CreateAction<any> = (bus) => ({
  id: SHOW_HISTORY,
  brief: "Open cron jobs execution history log",
  category: "automation",
  description: "Show history",
  invoke: () => {
    bus.present({ widget: createHistoryWidget(bus) });
  },
});

export { SHOW_HISTORY, createShowHistoryAction };

const ACTIONS = [createShowHistoryAction];

export default ACTIONS;
