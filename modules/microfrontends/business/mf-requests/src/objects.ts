import {
	defineMicrofrontend,
	objectOf,
	objectRef,
	setOf,
} from "front-core/object-runtime";
import type { RequestFiles, RequestProcessType } from "g-requests";
import { requestModelReceived } from "./domain-requests";
import { requestsClient, workflowClient } from "./services";
import { RequestDetailView } from "./views/RequestDetailView";
import { RequestsListView } from "./views/RequestsListView";

type RequestMutation = {
	source?: string;
	title?: string;
	summary?: string;
	processType?: RequestProcessType;
	fields?: Record<string, unknown>;
	files?: RequestFiles;
};

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
	},
	fields: { type: "object", description: "Known request fields only" },
	files: {
		type: "object",
		description:
			'Every file the message lists, as display name to ms-files file ID, for example {"part.stl": "file-id"}. An archive that was unpacked is listed by its contents, and those are what belongs here.',
	},
};

/** Build a preview and an estimate for every production model on the request.
 * Deterministic follow-up to creation, never a step the assistant has to think
 * about: it fails soft so a slicer outage cannot lose the request itself.
 *
 * It belongs to the operation, not to whoever calls it. Creation used to exist
 * twice — an assistant action that ran this, and this operation that did not —
 * so a request created through the catalog got no previews and no estimates. */
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

export default defineMicrofrontend({
	id: "mf-requests",
	types: [
		{
			id: "requests.request",
			label: "Manufacturing request",
			pluralLabel: "Manufacturing requests",
			categories: [
				"core.business",
				"core.selectable",
				"core.creatable",
				"core.editable",
			],
			selection: {
				filters: [],
				describe: () => requestsClient.describeSelection("requests.request"),
				load: (params) => requestsClient.listRequests(params),
				inspect: (filter) => requestsClient.inspectRequests(filter),
			},
		},
	],
	views: [
		{
			id: "requests.request.detail",
			accepts: objectOf("requests.request"),
			component: RequestDetailView,
			props: (ref) => ({
				requestId: ref.kind === "object" ? ref.id : undefined,
			}),
		},
		{
			id: "requests.request.table",
			accepts: setOf("requests.request"),
			component: RequestsListView,
		},
	],
	operations: [
		{
			id: "requests.request.create",
			operator: "create",
			target: "requests.request",
			label: "Create manufacturing request",
			description:
				"Create a request for uploaded files or a stated manufacturing need",
			access: "public",
			output: objectOf("requests.request"),
			parameters: { type: "object", properties: requestProperties },
			presentOutput: true,
			invoke: async ({ params }) => {
				const input = params as RequestMutation;
				const id = await requestsClient.createRequest({
					...input,
					fields: input.fields ?? {},
				});
				await analyzeRequestFiles(id);
				const model = await requestsClient.getRequestModel(id);
				if (model) requestModelReceived(model);
				return objectRef("requests.request", id, {
					title: model?.title ?? `Request ${id}`,
				});
			},
		},
		{
			id: "requests.request.save",
			operator: "save",
			target: "requests.request",
			label: "Save manufacturing request",
			inputs: [{ name: "request", accepts: objectOf("requests.request") }],
			parameters: { type: "object", properties: requestProperties },
			invoke: async ({ references, params }) => {
				const ref = references.find(
					(item) => item.kind === "object" && item.type === "requests.request",
				);
				if (ref?.kind !== "object")
					throw new Error("Request reference is required");
				return requestsClient.applyRequestUpdate(ref.id, params, "assistant");
			},
		},
	],
});
