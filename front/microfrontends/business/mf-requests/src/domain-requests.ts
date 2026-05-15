import { createDomain, sample } from "effector";
import { createInfiniteTableStore } from "front-core";
import type { RequestModel } from "g-requests";
import { requestsClient } from "./services";

const domain = createDomain("mf-requests");

export const requestsListMounted = domain.createEvent("REQUESTS_LIST_MOUNTED");
export const refreshRequestsClicked = domain.createEvent(
	"REFRESH_REQUESTS_CLICKED",
);
export const openRequestDetail = domain.createEvent<{ recordId: string }>(
	"OPEN_REQUEST_DETAIL",
);
export const requestDetailOpened = domain.createEvent<{
	requestId: string;
	model?: RequestModel | null;
}>("REQUEST_DETAIL_OPENED");
export const requestModelReceived = domain.createEvent<RequestModel>(
	"REQUEST_MODEL_RECEIVED",
);

const listRequestsFx = domain.createEffect({
	name: "LIST_REQUESTS",
	handler: async (params: { offset: number; limit: number }) => {
		return requestsClient.listRequests(params);
	},
});

export const $requestsStore = createInfiniteTableStore(domain, listRequestsFx);

const isIncomingModelStale = (
	current: RequestModel | null,
	incoming: RequestModel,
) => {
	if (!current || current.id !== incoming.id) return false;
	if (
		typeof current.revision === "number" &&
		typeof incoming.revision === "number" &&
		incoming.revision < current.revision
	) {
		return true;
	}
	const currentTime = Date.parse(current.updatedAt ?? "");
	const incomingTime = Date.parse(incoming.updatedAt ?? "");
	return (
		Number.isFinite(currentTime) &&
		Number.isFinite(incomingTime) &&
		incomingTime < currentTime
	);
};

export const loadRequestModelFx = domain.createEffect({
	name: "LOAD_REQUEST_MODEL",
	handler: async (requestId: string) => {
		const model = await requestsClient.getRequestModel(requestId);
		if (!model) {
			throw new Error(`Request not found: ${requestId}`);
		}
		return model;
	},
});

export const $activeRequestId = domain
	.createStore<string | null>(null)
	.on(requestDetailOpened, (_, payload) => payload.requestId);

export const $requestModel = domain
	.createStore<RequestModel | null>(null)
	.on(loadRequestModelFx.doneData, (current, model) => {
		if (isIncomingModelStale(current, model)) return current;
		return model;
	})
	.on(requestModelReceived, (current, model) => {
		if (current && current.id !== model.id) return current;
		if (isIncomingModelStale(current, model)) return current;
		return model;
	});

export const $requestLoading = domain
	.createStore(false)
	.on(loadRequestModelFx, () => true)
	.on(loadRequestModelFx.finally, () => false);

export const $requestError = domain
	.createStore<string | null>(null)
	.on(requestDetailOpened, () => null)
	.on(loadRequestModelFx.failData, (_, error) => error.message)
	.on(loadRequestModelFx.done, () => null);

sample({
	clock: requestDetailOpened,
	filter: (payload) => Boolean(payload.model?.id),
	fn: (payload) => payload.model as RequestModel,
	target: requestModelReceived,
});

sample({
	clock: requestDetailOpened,
	fn: ({ requestId }) => requestId,
	target: loadRequestModelFx,
});

sample({
	clock: requestsListMounted,
	filter: () => {
		const s = $requestsStore.$state.getState();
		return !s.isInitialized && !s.loading;
	},
	fn: () => ({}),
	target: $requestsStore.loadMore,
});

sample({
	clock: refreshRequestsClicked,
	fn: () => ({}),
	target: $requestsStore.reset,
});

sample({
	clock: refreshRequestsClicked,
	fn: () => ({}),
	target: $requestsStore.loadMore,
});

export default domain;
