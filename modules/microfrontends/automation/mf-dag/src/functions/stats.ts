import { CreateAction, CreateWidget } from "front-core";
import { StatsView } from "../views/StatsView";

const SHOW_DAG_STATS = "dag.stats.show";

const createStatsWidget: CreateWidget<typeof StatsView> = (bus) => ({
  view: StatsView,
  placement: () => "center",
  config: {
    bus: bus,
  },
  commands: {},
});

const createShowStatsAction: CreateAction<any> = (bus) => ({
  id: SHOW_DAG_STATS,
  llm: {
    microfrontend: "dag-mf",
    brief: "llm.actions.dag_stats_show.brief",
    description: "llm.actions.dag_stats_show.description",
  },
  exposure: "user",
  priority: "normal",
  invoke: () => {
    bus.present({ widget: createStatsWidget(bus) });
  },
});

export { SHOW_DAG_STATS, createShowStatsAction };

const ACTIONS = [createShowStatsAction];

export default ACTIONS;
