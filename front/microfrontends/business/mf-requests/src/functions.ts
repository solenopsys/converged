import { authToken, type CreateAction, type CreateWidget } from "front-core";
import type { RequestModel } from "g-requests";
import {
	OPEN_REQUEST,
	REFRESH_REQUEST,
	SHOW_REQUESTS,
	UPDATE_REQUEST_MODEL,
} from "./commands";
import { requestModelReceived } from "./domain-requests";
import Panel from "./Panel";

type OpenRequestParams = {
	requestId?: string;
	recordId?: string;
	model?: RequestModel | null;
	syncUrl?: boolean;
	replaceUrl?: boolean;
};

const createRequestsWidget: CreateWidget<typeof Panel> = (bus) => ({
	view: Panel,
	placement: () => "center",
	config: { bus },
});

const createRequestDetailWidget: CreateWidget<typeof Panel> = (bus) => ({
	view: Panel,
	placement: () => "center",
	config: { bus },
});

const createShowRequestsAction: CreateAction<unknown> = (bus) => ({
	id: SHOW_REQUESTS,
	description: "Show requests",
	invoke: () => {
		bus.present({ widget: createRequestsWidget(bus) });
	},
});

function syncRequestUrl(requestId: string, params?: OpenRequestParams) {
	if (typeof window === "undefined") return;
	if (params?.syncUrl === false) return;

	// `/console/*` is the authenticated admin surface. An anonymous/temporary
	// visitor filling a request on the landing must stay on the public route —
	// `/request/<id>` is SSR-routable and parsed by extractRequestIdForConsolePath.
	const base = authToken.isAuthenticated() ? "/console/request" : "/request";
	const nextPath = `${base}/${encodeURIComponent(requestId)}`;
	const nextUrl = `${nextPath}${window.location.search}${window.location.hash}`;
	const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
	if (currentUrl === nextUrl) {
		return;
	}

	if (params?.replaceUrl) {
		window.history.replaceState({ requestId }, "", nextUrl);
		return;
	}
	window.history.pushState({ requestId }, "", nextUrl);
}

const createOpenRequestAction: CreateAction<OpenRequestParams> = (bus) => ({
	id: OPEN_REQUEST,
	description: "Open request detail",
	invoke: (params = {}) => {
		const requestId = params.requestId ?? params.recordId ?? params.model?.id;
		if (!requestId) return;

		if (params.model?.id) requestModelReceived(params.model);
		syncRequestUrl(requestId, params);
		bus.present({
			widget: createRequestDetailWidget(bus),
			params: { requestId, model: params.model ?? null },
		});
	},
});

const createUpdateRequestModelAction: CreateAction<{
	model?: RequestModel | null;
}> = () => ({
	id: UPDATE_REQUEST_MODEL,
	description: "Apply updated request model to the opened request view",
	invoke: ({ model } = {}) => {
		if (model?.id) requestModelReceived(model);
	},
});

const createRefreshRequestAction: CreateAction<unknown> = () => ({
	id: REFRESH_REQUEST,
	description: "Refresh opened request model",
	invoke: () => {
		// SSE subscription handles updates automatically
	},
});

const ACTIONS = [
	createShowRequestsAction,
	createOpenRequestAction,
	createUpdateRequestModelAction,
	createRefreshRequestAction,
];

export {
	createOpenRequestAction,
	createRefreshRequestAction,
	createShowRequestsAction,
	createUpdateRequestModelAction,
	OPEN_REQUEST,
	REFRESH_REQUEST,
	SHOW_REQUESTS,
	UPDATE_REQUEST_MODEL,
};
export default ACTIONS;
