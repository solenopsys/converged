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
  llm: {
    microfrontend: "sheduller-mf",
    brief: "llm.actions.sheduller_stats_show.brief",
    description: "llm.actions.sheduller_stats_show.description",
  },
  exposure: "user",
  priority: "normal",
  invoke: () => {
    bus.present({ widget: createStatsWidget(bus) });
  },
});

export { SHOW_STATS, createShowStatsAction };

const ACTIONS = [createShowStatsAction];

export default ACTIONS;
