import {
	defineMicrofrontend,
	objectOf,
	objectRef,
	setOf,
} from "front-core/object-runtime";
import webhooksService from "./service";
import { EndpointsListView } from "./views/EndpointsListView";
import { WebhookLogsView } from "./views/WebhookLogsView";

export default defineMicrofrontend({
	id: "mf-webhooks",
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
		},
		{
			id: "webhooks.log",
			label: "Webhook log",
			pluralLabel: "Webhook logs",
			categories: ["core.automation", "core.selectable"],
		},
	],
	views: [
		{
			id: "webhooks.endpoint.table",
			accepts: setOf("webhooks.endpoint"),
			component: EndpointsListView,
		},
		{
			id: "webhooks.log.table",
			accepts: setOf("webhooks.log"),
			component: WebhookLogsView,
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
				const result = await webhooksService.createEndpoint(params as any);
				return objectRef(
					"webhooks.endpoint",
					String((result as any)?.id ?? params.id ?? crypto.randomUUID()),
				);
			},
		},
	],
});
