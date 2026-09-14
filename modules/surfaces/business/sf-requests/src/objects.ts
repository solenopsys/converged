import { EntityListView } from "front-core";
import {
	defineSurface,
	objectOf,
	objectRef,
	setOf,
} from "front-core/object-runtime";
import type {
	RequestFiles,
	RequestListParams,
	RequestProcessType,
} from "g-requests";
import { requestsColumns, tr } from "./config";
import { requestModelReceived } from "./domain-requests";
import { requestsClient, workflowClient } from "./services";
import { RequestDetailView } from "./views/RequestDetailView";

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
			'Every file the message lists, as display name to rp-files file ID, for example {"part.stl": "file-id"}. An archive that was unpacked is listed by its contents, and those are what belongs here.',
	},
};

/** The script that turns an accepted request into a job on the floor. */
const REQUEST_TO_ORDER_SCRIPT = "workflows/wf-request-to-order.js";

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

export default defineSurface({
	id: "sf-requests",
	label: "Requests",
	purpose:
		"Manufacturing requests from files and specs, before they become orders",
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
			infinity: {
				tableId: "requests",
				title: "Requests",
				columns: requestsColumns,
				load: (params) =>
					requestsClient.listRequests(params as RequestListParams),
				rowRef: (row) => {
					const request = row as {
						id?: unknown;
						model?: { title?: unknown };
					};
					const id = String(request.id ?? "");
					return objectRef("requests.request", id, {
						title:
							typeof request.model?.title === "string"
								? request.model.title
								: `Request ${id}`,
					});
				},
				filters: [
					{
						id: "source",
						label: "Source",
						type: "search",
						operator: "contains",
					},
					{
						id: "status",
						label: "Status",
						type: "select",
						operator: "eq",
						options: [
							{ value: "new", label: "New" },
							{ value: "draft", label: "Draft" },
							{ value: "needs_clarification", label: "Needs clarification" },
							{ value: "ready", label: "Ready" },
							{ value: "in_production", label: "In production" },
							{ value: "done", label: "Done" },
						],
					},
					{
						id: "createdAt",
						label: "Created",
						type: "date-range",
						operator: "between",
						valueType: "date",
					},
				],
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
			component: EntityListView,
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
			/**
			 * The step the product is for: an accepted request becomes work.
			 *
			 * It is a workflow call and not three calls from here because it spans
			 * rp-requests, rp-orders and rp-events, and a screen that got halfway
			 * through that leaves a job nobody ordered or a request nobody is
			 * making (§0, rule 1). Running it twice is safe — the workflow answers
			 * with the order that already exists — so the button needs no guard of
			 * its own.
			 */
			id: "requests.request.to-order",
			operator: "execute",
			target: "requests.request",
			label: "Create order from request",
			labelKey: "operations.to_order.label",
			description:
				"Put this request into production: the order carries the request id, the request moves to in_production and the step lands in the journal. Quantity, material, deadline and contact are read off the request unless given here. Running it twice opens the order that already exists.",
			descriptionKey: "operations.to_order.description",
			inputs: [{ name: "request", accepts: objectOf("requests.request") }],
			output: objectOf("orders.order"),
			parameters: {
				type: "object",
				properties: {
					productionMethod: {
						type: "string",
						enum: [
							"fdm",
							"sla",
							"sls",
							"dmls",
							"polyjet",
							"cnc",
							"laser",
							"generic",
						],
						description: "Overrides the method implied by the process type",
					},
					quantity: { type: "number" },
					material: { type: "string" },
					dueAt: { type: "string", description: "ISO date the job is owed" },
					equipmentId: {
						type: "string",
						description: "Assign the job to a machine straight away",
					},
					customerName: { type: "string" },
					customerEmail: { type: "string" },
					notes: { type: "string" },
				},
			},
			presentOutput: true,
			invoke: async ({ references, params }) => {
				const ref = references.find(
					(item) => item.kind === "object" && item.type === "requests.request",
				);
				if (ref?.kind !== "object") throw new Error(tr("errors.noRequestRef"));

				const run = await workflowClient.runWorkflow(REQUEST_TO_ORDER_SCRIPT, {
					requestId: ref.id,
					...params,
				});
				// A refused run is an ordinary outcome — most often the caller's role
				// has no `wf/workflows/wf-request-to-order.js(x)` grant — and saying
				// so is what makes the screen report it instead of doing nothing.
				if (!run.ok) throw new Error(run.error ?? tr("errors.orderFailed"));
				const report = (run.result ?? {}) as {
					orderId?: string;
					modelName?: string;
				};
				if (!report.orderId) throw new Error(tr("errors.noOrderReturned"));

				// The request's own status changed on the way through, so the card
				// behind this button has to be told.
				const model = await requestsClient.getRequestModel(ref.id);
				if (model) requestModelReceived(model);

				// The order, not a sentence: the runtime opens its card.
				return objectRef("orders.order", report.orderId, {
					...(report.modelName ? { title: report.modelName } : {}),
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
