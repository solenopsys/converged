import type { CreateAction, CreateWidget } from "front-core";
import { presentReference, setRef } from "front-core/object-runtime";
import { UsageStatsView } from "../views/UsageStatsView";

const SHOW_USAGE_LIST = "usage.list.show";
const SHOW_USAGE_STATS = "usage.stats.show";

const createUsageStatsWidget: CreateWidget<typeof UsageStatsView> = () => ({
	view: UsageStatsView,
	placement: () => "center",
	config: {},
});

const createShowUsageListAction: CreateAction = () => ({
	id: SHOW_USAGE_LIST,
	invoke: () => {
		void presentReference(setRef("usage.record", { kind: "query" }));
	},
});

const createShowUsageStatsAction: CreateAction = (bus) => ({
	id: SHOW_USAGE_STATS,
	invoke: () => {
		bus.present({ widget: createUsageStatsWidget(bus) });
	},
});

export {
	createShowUsageListAction,
	createShowUsageStatsAction,
	SHOW_USAGE_LIST,
	SHOW_USAGE_STATS,
};

const ACTIONS = [createShowUsageListAction, createShowUsageStatsAction];

export default ACTIONS;
