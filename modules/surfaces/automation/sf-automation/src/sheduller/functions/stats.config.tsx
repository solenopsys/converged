import type { CreateAction, CreateWidget } from "front-core";
import { StatsView } from "../views/StatsView";

const SHOW_STATS = "sheduller.stats.show";

const createStatsWidget: CreateWidget<typeof StatsView> = (bus) => ({
	view: StatsView,
	placement: () => ["float", "dashboard"],
	config: { bus },
});

const createShowStatsAction: CreateAction<any> = (bus) => ({
	id: SHOW_STATS,
	invoke: () => {
		bus.present({ widget: createStatsWidget(bus) });
	},
});

export { createShowStatsAction, SHOW_STATS };

const ACTIONS = [createShowStatsAction];

export default ACTIONS;
