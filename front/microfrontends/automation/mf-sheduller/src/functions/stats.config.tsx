import { CreateWidget, CreateAction } from "front-core";
import { StatsView } from "../views/StatsView";

const SHOW_STATS = "sheduller.stats.show";

const createStatsWidget: CreateWidget<typeof StatsView> = (bus) => ({
  view: StatsView,
  placement: () => ["float", "dashboard"],
  config: { bus },
});

const createShowStatsAction: CreateAction<any> = (bus) => ({
  id: SHOW_STATS,
  brief: "Open cron jobs statistics (runs, success/failure rates, timing)",
  category: "analytics",
  description: "Show sheduller statistics",
  invoke: () => {
    bus.present({ widget: createStatsWidget(bus) });
  },
});

export { SHOW_STATS, createShowStatsAction };

const ACTIONS = [createShowStatsAction];

export default ACTIONS;
