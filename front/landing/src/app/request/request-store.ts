import { createEffect, createEvent, createStore, sample } from "effector";
import { createRequestsServiceClient, type RequestModel } from "g-requests";

const requestsClient = createRequestsServiceClient({ baseUrl: "/services" });

declare global {
	var __REQUEST_MODEL_EVENT_HANDLER__: ((event: Event) => void) | undefined;
}

const requestFieldsSnapshot = (model?: Partial<RequestModel>) => {
	if (!model?.fields) return {};
	return Object.fromEntries(
		Object.entries(model.fields).map(([key, field]) => [key, field.value]),
	);
};

const requestModelSummary = (model?: Partial<RequestModel>) => {
	if (!model) return undefined;
	return {
		id: model.id,
		status: model.status,
		processType: model.processType,
		revision: model.revision,
		title: model.title,
		fields: requestFieldsSnapshot(model),
		remainingRequired: model.remainingRequired ?? model.missingRequired,
		completion: model.completion,
		updatedAt: model.updatedAt,
	};
};

const logRequestStore = (step: string, payload?: Record<string, any>) => {
	console.info(`[request-store] ${step}`, payload ?? {});
};

export const requestRouteOpened = createEvent<{ requestId: string }>();
export const requestRefreshRequested = createEvent();
export const requestModelReceived = createEvent<RequestModel>();

export const loadRequestModelFx = createEffect(async (requestId: string) => {
	logRequestStore("load.start", { requestId });
	const model = await requestsClient.getRequestModel(requestId);
	if (!model) {
		throw new Error(`Request not found: ${requestId}`);
	}
	logRequestStore("load.done", { model: requestModelSummary(model) });
	return model;
});

export const $requestId = createStore<string | null>(null).on(
	requestRouteOpened,
	(_, payload) => payload.requestId,
);

export const $requestModel = createStore<RequestModel | null>(null)
	.on(loadRequestModelFx.doneData, (_, model) => {
		logRequestStore("store.apply.loaded-model", {
			model: requestModelSummary(model),
		});
		return model;
	})
	.on(requestModelReceived, (current, model) => {
		if (current && current.id !== model.id) {
			logRequestStore("store.ignore.model-updated", {
				reason: "different_request_id",
				currentId: current.id,
				incoming: requestModelSummary(model),
			});
			return current;
		}
		logRequestStore("store.apply.model-updated", {
			currentRevision: current?.revision,
			incoming: requestModelSummary(model),
		});
		return model;
	});

export const $requestLoading = createStore(false)
	.on(loadRequestModelFx, () => true)
	.on(loadRequestModelFx.finally, () => false);

export const $requestError = createStore<string | null>(null)
	.on(requestRouteOpened, () => null)
	.on(loadRequestModelFx.failData, (_, error) => error.message)
	.on(loadRequestModelFx.done, () => null);

if (typeof window !== "undefined") {
	if (globalThis.__REQUEST_MODEL_EVENT_HANDLER__) {
		window.removeEventListener(
			"request:model-updated",
			globalThis.__REQUEST_MODEL_EVENT_HANDLER__,
		);
	}
	globalThis.__REQUEST_MODEL_EVENT_HANDLER__ = (event: Event) => {
		const model = (event as CustomEvent<RequestModel>).detail;
		if (!model?.id) return;
		logRequestStore("event.model-updated.received", {
			model: requestModelSummary(model),
		});
		requestModelReceived(model);
	};
	window.addEventListener(
		"request:model-updated",
		globalThis.__REQUEST_MODEL_EVENT_HANDLER__,
	);
}

requestRouteOpened.watch(({ requestId }) => {
	logRequestStore("route.opened", { requestId });
});

requestRefreshRequested.watch(() => {
	logRequestStore("refresh.requested", {});
});

loadRequestModelFx.fail.watch(({ params, error }) => {
	logRequestStore("load.fail", {
		requestId: params,
		error: error.message,
	});
});

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
