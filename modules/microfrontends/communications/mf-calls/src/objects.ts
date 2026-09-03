import {
	Category,
	defineMicrofrontend,
	type ObjectDefinition,
	objectOf,
	objectRef,
	setOf,
} from "front-core/object-runtime";
import {
	callsClient,
	openCallDetail,
	startNewCallClicked,
} from "./domain-calls";
import { ActiveCallView } from "./views/ActiveCallView";
import { CallDetailView } from "./views/CallDetailView";
import { CallsListView } from "./views/CallsListView";
import { webCallRequested } from "./web-call/controller";
import { mountWebCallWidget } from "./web-call/mount";

export const objects = [
	{
		id: "calls.call",
		label: "Call",
		pluralLabel: "Calls",
		categories: [
			Category.Communication,
			Category.Selectable,
			Category.Creatable,
			Category.Executable,
		],
		selection: {
			filters: [],
			describe: () => callsClient.describeSelection("calls.call"),
			load: (params) => callsClient.listCalls(params),
			inspect: (filter) => callsClient.inspectCalls(filter),
		},
	},
] satisfies readonly ObjectDefinition[];

export default defineMicrofrontend({
	id: "mf-calls",
	types: objects,
	views: [
		{
			id: "calls.call.detail",
			accepts: objectOf("calls.call"),
			component: CallDetailView,
			props: (ref) => {
				const sessionId = ref.kind === "object" ? ref.id : "";
				if (sessionId) openCallDetail({ sessionId });
				return { sessionId };
			},
		},
		{
			id: "calls.call.table",
			accepts: setOf("calls.call"),
			component: CallsListView,
		},
		{
			id: "calls.call.active",
			accepts: objectOf("calls.call"),
			component: ActiveCallView,
			priority: -1,
		},
	],
	operations: [
		{
			id: "calls.call.create",
			operator: "create",
			target: "calls.call",
			label: "Start call",
			output: objectOf("calls.call"),
			invoke: () => {
				startNewCallClicked();
				return objectRef("calls.call", crypto.randomUUID());
			},
		},
		{
			id: "calls.call.execute-web",
			operator: "execute",
			target: "calls.call",
			label: "Start web call",
			parameters: {
				type: "object",
				properties: { contextName: { type: "string" } },
			},
			invoke: ({ params }) => {
				mountWebCallWidget();
				webCallRequested(params.contextName as string | undefined);
			},
		},
	],
});
