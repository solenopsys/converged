import { CreateAction, CreateWidget } from "front-core";
import { UsageListView } from "../views/UsageListView";
import { UsageStatsView } from "../views/UsageStatsView";

const SHOW_USAGE_LIST = "usage.list.show";
const SHOW_USAGE_STATS = "usage.stats.show";

const createUsageListWidget: CreateWidget<typeof UsageListView> = () => ({
  view: UsageListView,
  placement: () => "center",
  config: {},
});

const createUsageStatsWidget: CreateWidget<typeof UsageStatsView> = () => ({
  view: UsageStatsView,
  placement: () => "center",
  config: {},
});

const createShowUsageListAction: CreateAction<any> = (bus) => ({
  id: SHOW_USAGE_LIST,
  description: "Show usage events",
  invoke: () => {
    bus.present({ widget: createUsageListWidget(bus) });
  },
});

const createShowUsageStatsAction: CreateAction<any> = (bus) => ({
  id: SHOW_USAGE_STATS,
  description: "Show usage statistics",
  invoke: () => {
    bus.present({ widget: createUsageStatsWidget(bus) });
  },
});

export { SHOW_USAGE_LIST, SHOW_USAGE_STATS, createShowUsageListAction, createShowUsageStatsAction };

const ACTIONS = [createShowUsageListAction, createShowUsageStatsAction];

export default ACTIONS;
