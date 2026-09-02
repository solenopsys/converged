import { authToken, type CreateAction, type CreateWidget } from "front-core";
import type {
	RequestFiles,
	RequestModel,
	RequestProcessType,
} from "g-requests";
import {
	CREATE_REQUEST,
	GET_REQUEST,
	OPEN_REQUEST,
	REFRESH_REQUEST,
	SHOW_REQUESTS,
	UPDATE_REQUEST,
	UPDATE_REQUEST_MODEL,
} from "./commands";
import { requestModelReceived } from "./domain-requests";
import Panel from "./Panel";
import { requestsClient, workflowClient } from "./services";

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
	invoke: (params = {}) => {
		const requestId = params.requestId ?? params.recordId ?? params.model?.id;
		if (!requestId) return;

		if (params.model?.id) requestModelReceived(params.model);
		syncRequestUrl(requestId, params);
		bus.present({
			widget: createRequestDetailWidget(bus),
			params: { requestId, model: params.model ?? null },
			tab: {
				key: `${OPEN_REQUEST}:${requestId}`,
				title: `Request ${requestId}`,
			},
		});
	},
});

const createUpdateRequestModelAction: CreateAction<{
	model?: RequestModel | null;
}> = () => ({
	id: UPDATE_REQUEST_MODEL,
	invoke: ({ model } = {}) => {
		if (model?.id) requestModelReceived(model);
	},
});

const createRefreshRequestAction: CreateAction<unknown> = () => ({
	id: REFRESH_REQUEST,
	invoke: () => {
		// SSE subscription handles updates automatically
	},
});

type RequestMutation = {
	source?: string;
	title?: string;
	summary?: string;
	processType?: RequestProcessType;
	fields?: Record<string, unknown>;
	files?: RequestFiles;
};

/** A request ID is an unguessable capability: this URL is the hand-off from a
 * public Club intake to the customer, without requiring an account or email. */
function publicRequestUrl(requestId: string): string {
	if (typeof window === "undefined")
		return `/request/${encodeURIComponent(requestId)}`;
	return `${window.location.origin}/request/${encodeURIComponent(requestId)}`;
}

const requestProperties = {
	source: {
		type: "string",
		description: "Short user-provided request description",
	},
	title: { type: "string", description: "Short request title" },
	summary: {
		type: "string",
		description: "Structured summary of known requirements",
	},
	processType: {
		type: "string",
		enum: [
			"cnc_machining",
			"laser_cutting",
			"plastic_cutting",
			"3d_printing",
			"generic",
		],
		description:
			"Manufacturing process; use generic when the uploaded files are not enough to decide",
	},
	fields: {
		type: "object",
		description: "Known request fields only; do not invent values",
	},
	files: {
		type: "object",
		description:
			'Uploaded files as display name to ms-files file ID, for example {"part.step": "uuid"}',
	},
};

/** Build a preview and an estimate for every production model on the request.
 * Deterministic follow-up to creation, never a step the assistant has to think
 * about: it fails soft so a slicer outage cannot lose the request itself. */
async function analyzeRequestFiles(requestId: string): Promise<void> {
	try {
		const run = await workflowClient.runWorkflow(
			"workflows/wf-request-analyze.js",
			{ requestId },
		);
		if (!run.ok) {
			console.error("[requests] analysis failed", requestId, run.error);
		}
	} catch (error) {
		console.error("[requests] analysis unavailable", requestId, error);
	}
}

const createRequestAction: CreateAction<RequestMutation> = () => ({
	id: CREATE_REQUEST,
	access: "public",
	category: "requests",
	exposure: "llm",
	priority: "primary",
	brief: "Create a manufacturing request",
	description:
		"Create a request for uploaded files or a stated manufacturing need. Include every uploaded file ID in files and only explicitly known fields.",
	parameters: { type: "object", properties: requestProperties },
	invoke: async (input = {}) => {
		const id = await requestsClient.createRequest({
			...input,
			fields: input.fields ?? {},
		});
		await analyzeRequestFiles(id);
		const model = await requestsClient.getRequestModel(id);
		return {
			...(model ?? { id }),
			publicUrl: publicRequestUrl(id),
		};
	},
});

const createGetRequestAction: CreateAction<{ requestId: string }> = () => ({
	id: GET_REQUEST,
	category: "requests",
	exposure: "llm",
	brief: "Get a request",
	description:
		"Get the current request model, including files and missing requirements.",
	parameters: {
		type: "object",
		properties: { requestId: { type: "string", description: "Request ID" } },
		required: ["requestId"],
	},
	invoke: async ({ requestId }) =>
		(await requestsClient.getRequestModel(requestId)) ?? {
			id: requestId,
			found: false,
		},
});

const createUpdateRequestAction: CreateAction<
	RequestMutation & { requestId: string }
> = () => ({
	id: UPDATE_REQUEST,
	category: "requests",
	exposure: "llm",
	brief: "Update a request",
	description:
		"Apply extracted or explicitly supplied fields to an existing request.",
	parameters: {
		type: "object",
		properties: {
			requestId: { type: "string", description: "Request ID" },
			...requestProperties,
		},
		required: ["requestId"],
	},
	invoke: async ({ requestId, ...patch }) =>
		requestsClient.applyRequestUpdate(requestId, patch, "assistant"),
});

const ACTIONS = [
	createShowRequestsAction,
	createOpenRequestAction,
	createUpdateRequestModelAction,
	createRefreshRequestAction,
	createRequestAction,
	createGetRequestAction,
	createUpdateRequestAction,
];

export {
	CREATE_REQUEST,
	createGetRequestAction,
	createOpenRequestAction,
	createRefreshRequestAction,
	createRequestAction,
	createShowRequestsAction,
	createUpdateRequestAction,
	createUpdateRequestModelAction,
	GET_REQUEST,
	OPEN_REQUEST,
	REFRESH_REQUEST,
	SHOW_REQUESTS,
	UPDATE_REQUEST,
	UPDATE_REQUEST_MODEL,
};
export default ACTIONS;
