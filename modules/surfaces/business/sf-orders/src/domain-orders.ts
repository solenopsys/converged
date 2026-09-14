import { createDomain, sample } from "effector";
import type { FileMetadata } from "g-files";
import type { Order, OrderDashboard } from "g-orders";
import type { RequestMetrics } from "g-requests";
import { filesClient, ordersClient, requestsClient } from "./services";

const domain = createDomain("sf-orders");

export const ordersViewMounted = domain.createEvent("ORDERS_VIEW_MOUNTED");
export const refreshOrdersClicked = domain.createEvent(
	"REFRESH_ORDERS_CLICKED",
);

/** A card was opened as a subtab, and which one. */
export const orderOpened = domain.createEvent<{ orderId: string }>(
	"ORDER_OPENED",
);

/** An operation persisted a change; every mounted view of that order redraws. */
export const orderChanged = domain.createEvent<Order>("ORDER_CHANGED");

export const loadDashboardFx = domain.createEffect({
	name: "LOAD_ORDERS_DASHBOARD",
	handler: async (): Promise<{
		orders: OrderDashboard;
		requests: RequestMetrics;
	}> => {
		// Two services, read side by side in the browser: the conversion tile is a
		// composition, and neither repository may ask the other for its half.
		const [orders, requests] = await Promise.all([
			ordersClient.getOrderDashboard(),
			requestsClient.getRequestMetrics(),
		]);
		return { orders, requests };
	},
});

const loadOrderFx = domain.createEffect({
	name: "LOAD_ORDER",
	handler: (orderId: string) => ordersClient.getOrder(orderId),
});

/** A file on the order card, as the card needs it: the name the request called
 *  it plus whatever `rp-files` still knows about it. */
export type AttachedFile = {
	label: string;
	fileId: string;
	metadata?: FileMetadata;
};

/**
 * The drawings a job is made from.
 *
 * The order does not hold them — the request does, under the names the customer
 * used — so this follows `requestId` and then asks `rp-files` about each id. Two
 * services read side by side in the browser, which is the allowed shape; a
 * workflow would buy durability that a read does not need.
 *
 * Fails soft on every step: a file that was deleted, or that this person may not
 * see, becomes a row without metadata rather than an error that hides the rest of
 * the card.
 */
const loadOrderFilesFx = domain.createEffect({
	name: "LOAD_ORDER_FILES",
	handler: async (requestId: string): Promise<AttachedFile[]> => {
		const model = await requestsClient.getRequestModel(requestId);
		// The empty fallback has to carry the value type, or `entries` widens the
		// file ids to `unknown` and every use of one needs a cast.
		const files: Record<string, string> = model?.files ?? {};
		const entries = Object.entries(files);
		return Promise.all(
			entries.map(async ([label, fileId]) => {
				try {
					const metadata = await filesClient.get(fileId);
					return { label, fileId, metadata: metadata ?? undefined };
				} catch {
					return { label, fileId };
				}
			}),
		);
	},
});

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

export const $orderCard = domain
	.createStore<{
		order: Order | null;
		files: AttachedFile[];
		filesLoading: boolean;
		loading: boolean;
		error: string | null;
	}>({
		order: null,
		files: [],
		filesLoading: false,
		loading: false,
		error: null,
	})
	.on(orderOpened, (state) => ({
		...state,
		order: null,
		files: [],
		error: null,
	}))
	.on(loadOrderFx.pending, (state, loading) => ({ ...state, loading }))
	.on(loadOrderFx.doneData, (state, order) => ({
		...state,
		order: order ?? null,
		loading: false,
		error: null,
	}))
	.on(loadOrderFx.failData, (state, error) => ({
		...state,
		loading: false,
		error: error.message,
	}))
	// An operation that saved this order hands the fresh record straight over,
	// so the card does not have to re-read what the caller already has.
	.on(orderChanged, (state, order) =>
		state.order && state.order.id !== order.id ? state : { ...state, order },
	)
	.on(loadOrderFilesFx.pending, (state, filesLoading) => ({
		...state,
		filesLoading,
	}))
	.on(loadOrderFilesFx.doneData, (state, files) => ({
		...state,
		files,
		filesLoading: false,
	}))
	.on(loadOrderFilesFx.failData, (state) => ({
		...state,
		files: [],
		filesLoading: false,
	}));

sample({
	clock: orderOpened,
	fn: ({ orderId }) => orderId,
	target: loadOrderFx,
});

// Only jobs that came from a request have files to show, and the id is on the
// order we just read — so this waits for it rather than firing alongside.
sample({
	clock: loadOrderFx.doneData,
	filter: (order): order is Order => Boolean(order?.requestId),
	fn: (order) => order.requestId as string,
	target: loadOrderFilesFx,
});

// Five statistic tiles report mounting, and they all want the same two reads.
// Refresh is explicit and always goes through.
sample({
	clock: ordersViewMounted,
	filter: () => !loadDashboardFx.pending.getState(),
	target: loadDashboardFx,
});

sample({
	clock: refreshOrdersClicked,
	target: loadDashboardFx,
});

export default domain;
