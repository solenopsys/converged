import { createEffect, createEvent, createStore, sample } from "effector";
import { createRequestsServiceClient, type RequestModel } from "g-requests";

const requestsClient = createRequestsServiceClient({ baseUrl: "/services" });

export const requestRouteOpened = createEvent<{ requestId: string }>();
export const requestRefreshRequested = createEvent();
export const requestModelReceived = createEvent<RequestModel>();

export const loadRequestModelFx = createEffect(async (requestId: string) => {
	const model = await requestsClient.getRequestModel(requestId);
	if (!model) {
		throw new Error(`Request not found: ${requestId}`);
	}
	return model;
});

export const $requestId = createStore<string | null>(null).on(
	requestRouteOpened,
	(_, payload) => payload.requestId,
);

export const $requestModel = createStore<RequestModel | null>(null)
	.on(loadRequestModelFx.doneData, (_, model) => model)
	.on(requestModelReceived, (current, model) => {
		if (current && current.id !== model.id) return current;
		return model;
	});

export const $requestLoading = createStore(false)
	.on(loadRequestModelFx, () => true)
	.on(loadRequestModelFx.finally, () => false);

export const $requestError = createStore<string | null>(null)
	.on(requestRouteOpened, () => null)
	.on(loadRequestModelFx.failData, (_, error) => error.message)
	.on(loadRequestModelFx.done, () => null);

sample({
	clock: requestRouteOpened,
	fn: ({ requestId }) => requestId,
	target: loadRequestModelFx,
});

sample({
	clock: requestRefreshRequested,
	source: $requestId,
	filter: (requestId): requestId is string => Boolean(requestId),
	target: loadRequestModelFx,
});
