import { EntityListView, Plus } from "front-core";
import type { SurfaceDefinition } from "front-core/object-runtime";
import { objectOf, objectRef, setOf } from "front-core/object-runtime";
import type {
	WebhookEndpointInput,
	WebhookEndpointListParams,
	WebhookLogListParams,
} from "g-webhooks";
import { addEndpointClicked, openEndpointForm } from "./domain-endpoints";
import { endpointColumns, logColumns } from "./functions/columns";
import webhooksService from "./service";
import { EndpointFormView } from "./views/EndpointFormView";

export const webhooksContribution: Pick<
	SurfaceDefinition,
	"types" | "views" | "operations"
> = {
	types: [
		{
			id: "webhooks.endpoint",
			label: "Webhook endpoint",
			pluralLabel: "Webhook endpoints",
			categories: [
				"core.automation",
				"core.selectable",
				"core.creatable",
				"core.editable",
			],
			selection: {
				filters: [],
				describe: () => webhooksService.describeSelection("webhooks.endpoint"),
				load: (params) => webhooksService.listEndpoints(params),
				inspect: (filter) => webhooksService.inspectEndpoints(filter),
			},
			infinity: {
				tableId: "webhook-endpoints",
				title: "Webhook endpoints",
				columns: endpointColumns,
				load: (params) =>
					webhooksService.listEndpoints(params as WebhookEndpointListParams),
				rowRef: (endpoint) =>
					objectRef("webhooks.endpoint", String(endpoint.id), {
						title:
							typeof endpoint.name === "string" ? endpoint.name : undefined,
					}),
				filters: [
					{ id: "name", label: "Name", type: "search", operator: "contains" },
					{ id: "provider", label: "Provider", type: "search", operator: "eq" },
					{
						id: "enabled",
						label: "Enabled",
						type: "select",
						operator: "eq",
						valueType: "boolean",
						options: [
							{ value: "true", label: "Enabled" },
							{ value: "false", label: "Disabled" },
						],
					},
				],
				actions: [
					{
						id: "add",
						label: "New endpoint",
						icon: Plus,
						event: addEndpointClicked,
						variant: "default" as const,
					},
				],
			},
		},
		{
			id: "webhooks.log",
			label: "Webhook log",
			pluralLabel: "Webhook logs",
			categories: ["core.automation", "core.selectable"],
			selection: {
				filters: [],
				describe: () => webhooksService.describeSelection("webhooks.log"),
				load: (params) => webhooksService.listLogs(params),
				inspect: (filter) => webhooksService.inspectLogs(filter),
			},
			infinity: {
				tableId: "webhook-logs",
				title: "Webhook logs",
				columns: logColumns,
				load: (params) =>
					webhooksService.listLogs(params as WebhookLogListParams),
				rowRef: (entry) => objectRef("webhooks.log", String(entry.id)),
				filters: [
					{
						id: "endpointId",
						label: "Endpoint",
						type: "search",
						operator: "eq",
					},
					{ id: "provider", label: "Provider", type: "search", operator: "eq" },
					{ id: "method", label: "Method", type: "search", operator: "eq" },
					{ id: "path", label: "Path", type: "search", operator: "contains" },
					{
						id: "status",
						label: "Status",
						type: "search",
						operator: "eq",
						valueType: "number",
					},
				],
			},
		},
	],
	views: [
		{
			id: "webhooks.endpoint.table",
			accepts: setOf("webhooks.endpoint"),
			component: EntityListView,
		},
		{
			id: "webhooks.endpoint.detail",
			accepts: objectOf("webhooks.endpoint"),
			component: EndpointFormView,
			props: (ref) => {
				if (ref.kind === "object") loadEndpoint(ref.id);
				return {};
			},
		},
		{
			id: "webhooks.log.table",
			accepts: setOf("webhooks.log"),
			component: EntityListView,
		},
	],
	operations: [
		{
			id: "webhooks.endpoint.create",
			operator: "create",
			target: "webhooks.endpoint",
			label: "Create webhook endpoint",
			output: objectOf("webhooks.endpoint"),
			parameters: { type: "object", properties: {} },
			invoke: async ({ params }) => {
				const result = (await webhooksService.createEndpoint(
					params as WebhookEndpointInput,
				)) as { id?: string | number } | undefined;
				return objectRef(
					"webhooks.endpoint",
					String(result?.id ?? params.id ?? crypto.randomUUID()),
				);
			},
		},
	],
};

/**
 * The list holds the row; the form wants the record, so fetch the one row.
 * `new` is not a row — it is how the header button asks for a blank form.
 */
async function loadEndpoint(id: string): Promise<void> {
	if (id === "new") {
		openEndpointForm({ endpoint: null });
		return;
	}
	const result = await webhooksService.listEndpoints({
		offset: 0,
		limit: 1,
		filter: { id: { eq: id } },
	} as WebhookEndpointListParams);
	openEndpointForm({ endpoint: result?.items?.[0] ?? null });
}
