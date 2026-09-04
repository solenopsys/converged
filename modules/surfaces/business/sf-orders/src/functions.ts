import type { CreateAction, CreateWidget } from "front-core";
import Panel from "./Panel";

const SHOW_ORDERS = "orders.show";

const createOrdersWidget: CreateWidget<typeof Panel> = (_bus) => ({
	view: Panel,
	placement: () => "center",
	config: {},
});

const createShowOrdersAction: CreateAction<any> = (bus) => ({
	id: SHOW_ORDERS,
	invoke: () => {
		bus.present({ widget: createOrdersWidget(bus) });
	},
});

const ACTIONS = [createShowOrdersAction];

export { createShowOrdersAction, SHOW_ORDERS };
export default ACTIONS;
