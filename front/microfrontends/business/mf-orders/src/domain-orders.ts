import { createDomain, sample } from "effector";
import type { OrderDashboard, OrderStatusGroup } from "g-orders";
import type { RequestMetrics } from "g-requests";
import { createInfiniteTableStore } from "front-core";
import { ordersClient, requestsClient } from "./services";

const domain = createDomain("mf-orders");

export const ordersViewMounted = domain.createEvent("ORDERS_VIEW_MOUNTED");
export const refreshOrdersClicked = domain.createEvent("REFRESH_ORDERS_CLICKED");
export const orderStatusGroupChanged =
	domain.createEvent<OrderStatusGroup>("ORDER_STATUS_GROUP_CHANGED");
export const openOrderDetail =
	domain.createEvent<{ recordId: string }>("OPEN_ORDER_DETAIL");

const listOrdersFx = domain.createEffect({
	name: "LIST_ORDERS",
	handler: async (params: {
		offset: number;
		limit: number;
		statusGroup?: OrderStatusGroup;
	}) => {
		return ordersClient.listOrders(params);
	},
});

const loadDashboardFx = domain.createEffect({
	name: "LOAD_ORDERS_DASHBOARD",
	handler: async (): Promise<{
		orders: OrderDashboard;
		requests: RequestMetrics;
	}> => {
		const [orders, requests] = await Promise.all([
			ordersClient.getOrderDashboard(),
			requestsClient.getRequestMetrics(),
		]);
		return { orders, requests };
	},
});

export const $ordersStore = createInfiniteTableStore(domain, listOrdersFx);

export const $statusGroup = domain
	.createStore<OrderStatusGroup>("all")
	.on(orderStatusGroupChanged, (_, group) => group);

export const $dashboardState = domain
	.createStore<{
		orders: OrderDashboard | null;
		requests: RequestMetrics | null;
		loading: boolean;
		error: string | null;
	}>({
		orders: null,
		requests: null,
		loading: false,
		error: null,
	})
	.on(loadDashboardFx.pending, (state, loading) => ({
		...state,
		loading,
	}))
	.on(loadDashboardFx.doneData, (_, payload) => ({
		...payload,
		loading: false,
		error: null,
	}))
	.on(loadDashboardFx.failData, (state, error) => ({
		...state,
		loading: false,
		error: error.message,
	}));

sample({
	clock: ordersViewMounted,
	filter: () => {
		const state = $ordersStore.$state.getState();
		return !state.isInitialized && !state.loading;
	},
	fn: () => ({}),
	target: $ordersStore.loadMore,
});

sample({
	clock: ordersViewMounted,
	target: loadDashboardFx,
});

sample({
	clock: refreshOrdersClicked,
	fn: () => ({}),
	target: $ordersStore.reset,
});

sample({
	clock: refreshOrdersClicked,
	fn: () => ({}),
	target: $ordersStore.loadMore,
});

sample({
	clock: refreshOrdersClicked,
	target: loadDashboardFx,
});

sample({
	clock: orderStatusGroupChanged,
	fn: (group) => (group === "all" ? {} : { statusGroup: group }),
	target: $ordersStore.setFilters,
});

export default domain;
