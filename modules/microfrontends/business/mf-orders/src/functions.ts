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
	llm: {
		microfrontend: "orders-mf",
		brief: "llm.actions.orders_show.brief",
		description: "llm.actions.orders_show.description",
	},
	exposure: "user",
	priority: "primary",
	invoke: () => {
		bus.present({ widget: createOrdersWidget(bus) });
	},
});

const ACTIONS = [createShowOrdersAction];

export { SHOW_ORDERS, createShowOrdersAction };
export default ACTIONS;
