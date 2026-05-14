import { CreateAction, CreateWidget } from "front-core";
import Panel from "./Panel";

const SHOW_ORDERS = "orders.show";

const createOrdersWidget: CreateWidget<typeof Panel> = (_bus) => ({
	view: Panel,
	placement: () => "center",
	config: {},
});

const createShowOrdersAction: CreateAction<any> = (bus) => ({
	id: SHOW_ORDERS,
	description: "Show orders",
	invoke: () => {
		bus.present({ widget: createOrdersWidget(bus) });
	},
});

const ACTIONS = [createShowOrdersAction];

export { SHOW_ORDERS, createShowOrdersAction };
export default ACTIONS;
