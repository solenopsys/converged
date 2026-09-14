import { EntityListView } from "front-core";
import {
	Category,
	defineSurface,
	type ObjectDefinition,
	objectOf,
	objectRef,
	setOf,
} from "front-core/object-runtime";
import type { OrderListParams, OrderStatus } from "g-orders";
import {
	methodOptions,
	ORDER_STATUSES,
	ordersColumns,
	PRODUCTION_METHODS,
	statusOptions,
	tr,
} from "./config";
import {
	ConversionIndicator,
	OrdersIndicator,
	PrintingIndicator,
	RequestsIndicator,
	UtilizationIndicator,
} from "./dashboard-widgets";
import { orderChanged } from "./domain-orders";
import { equipmentClient, ordersClient } from "./services";
import { OrdersSummary } from "./summary";
import { OrderDetailView } from "./views/OrderDetailView";
import { OrdersDashboardView } from "./views/OrdersDashboardView";

// Orders as one working area: the queue of the shop floor.
//
// The table is the main screen and the dashboard is beside it, not instead of
// it — a readout answers "how much work is there", and only a list answers "what
// do I do next". A job opens as a closable button inside this same tab.
//
// Nothing here creates the link to a request. `Order.requestId` is written by
// wf-request-to-order, because moving a request into production touches three
// services and a screen may not cascade (§0, rule 1). What this surface owns is
// everything afterwards: status, the machine, the fields.

/**
 * Preset tabs travel as the server-owned predicates they are meant to become.
 * `rp-orders` does not compile them yet, so the status group each tab stands for
 * is translated here into the `statusGroup` the contract already understands —
 * which is what makes the tabs filter for real instead of only looking right.
 */
function orderListParams(params: Record<string, unknown>): OrderListParams {
	const { presets, ...rest } = params as {
		presets?: { id?: string; params?: Record<string, unknown> }[];
	} & Record<string, unknown>;
	const group = (presets ?? [])
		.map((preset) => preset.params?.statusGroup)
		.find((value): value is string => typeof value === "string");
	return {
		...rest,
		...(group ? { statusGroup: group } : {}),
	} as OrderListParams;
}

const loadOrders = (params: Record<string, unknown>) =>
	ordersClient.listOrders(orderListParams(params));

/** The groups `rp-orders` collapses statuses into, as the queue's tabs. */
const STATUS_GROUP_TABS = [
	{ id: "orders.all", group: undefined, key: "tabs.all" },
	{ id: "orders.queued", group: "queued", key: "tabs.queued" },
	{ id: "orders.in_progress", group: "in_progress", key: "tabs.in_progress" },
	{ id: "orders.completed", group: "completed", key: "tabs.completed" },
	{ id: "orders.blocked", group: "blocked", key: "tabs.blocked" },
] as const;

/** What an order is, as the assistant may fill it in. */
const orderProperties = {
	modelName: { type: "string", description: "What is being made" },
	productionMethod: {
		type: "string",
		enum: [...PRODUCTION_METHODS],
		description: "Machine class the job runs on",
	},
	quantity: { type: "number" },
	material: { type: "string" },
	weightGrams: { type: "number", description: "Material per piece, in grams" },
	dueAt: { type: "string", description: "ISO date the job is owed" },
	notes: { type: "string" },
	customerName: { type: "string" },
	customerEmail: {
		type: "string",
		description: "Where the review request goes once the job ships",
	},
};

export const objects = [
	{
		id: "orders.order",
		label: "Order",
		labelKey: "types.order.label",
		pluralLabel: "Orders",
		pluralLabelKey: "menu.orders",
		description:
			"One production job: what is made, on what machine, by when, and where it came from",
		descriptionKey: "types.order.description",
		categories: [
			Category.Business,
			Category.Selectable,
			Category.Creatable,
			Category.Editable,
		],
		selection: {
			filters: [
				{
					id: "status",
					label: tr("columns.status"),
					valueType: "string",
					operators: ["eq", "in"],
					control: "select",
					options: statusOptions().map((option) => ({
						id: option.value,
						label: option.label,
					})),
				},
				{
					id: "productionMethod",
					label: tr("columns.method"),
					valueType: "string",
					operators: ["eq", "in"],
					control: "select",
					options: methodOptions().map((option) => ({
						id: option.value,
						label: option.label,
					})),
				},
			],
			describe: () => ordersClient.describeSelection("orders.order"),
			load: loadOrders,
			inspect: (filter) => ordersClient.inspectOrders(filter),
		},
		infinity: {
			tableId: "orders",
			title: tr("menu.orders"),
			columns: ordersColumns(),
			load: loadOrders,
			rowRef: (row) => {
				const order = row as { id?: unknown; modelName?: unknown };
				const id = String(order.id ?? "");
				return objectRef("orders.order", id, {
					title:
						(typeof order.modelName === "string" && order.modelName) ||
						`Order ${id}`,
				});
			},
			filters: [
				{
					id: "status",
					label: tr("columns.status"),
					type: "select",
					operator: "eq",
					options: statusOptions(),
				},
				{
					id: "productionMethod",
					label: tr("columns.method"),
					type: "select",
					operator: "eq",
					options: methodOptions(),
				},
				{
					id: "dueAt",
					label: tr("columns.due"),
					type: "date-range",
					operator: "between",
					valueType: "date",
				},
				{
					id: "requestId",
					label: tr("columns.request"),
					type: "search",
					operator: "eq",
				},
			],
			presets: STATUS_GROUP_TABS.map((tab) => ({
				id: tab.id,
				label: tr(tab.key),
				control: "tab" as const,
				group: "orders-status",
				...(tab.group ? { defaults: { statusGroup: tab.group } } : {}),
			})),
			mobile: { title: "modelName", subtitle: "material", badge: "status" },
		},
	},
	// The dashboard's readout for this service, shown while its section is
	// collapsed. Everything below it is a block inside the opened section.
	{
		id: "orders.statistic.summary",
		label: "Orders",
		labelKey: "menu.orders",
		categories: [Category.Statistic, Category.Business],
		statistic: { role: "summary", component: OrdersSummary },
	},
	{
		id: "orders.statistic.requests",
		label: "Requests",
		labelKey: "widgets.requests.title",
		categories: [Category.Statistic, Category.Business],
		statistic: { component: RequestsIndicator },
	},
	{
		id: "orders.statistic.orders",
		label: "Orders",
		labelKey: "widgets.orders.title",
		categories: [Category.Statistic, Category.Business],
		statistic: { component: OrdersIndicator },
	},
	{
		id: "orders.statistic.printing",
		label: "Printing",
		labelKey: "widgets.printing.title",
		categories: [Category.Statistic, Category.Business],
		statistic: { component: PrintingIndicator },
	},
	{
		id: "orders.statistic.utilization",
		label: "In progress",
		labelKey: "widgets.progress.title",
		categories: [Category.Statistic, Category.Business],
		statistic: { component: UtilizationIndicator },
	},
	{
		id: "orders.statistic.conversion",
		label: "Request to order conversion",
		labelKey: "widgets.conversion.title",
		categories: [Category.Statistic, Category.Business, Category.Financial],
		statistic: { component: ConversionIndicator, size: "lg" },
	},
	{
		// The surface's own screen. A statistical type with no `component` is
		// resolved through its `setOf` view, which the shell then gives the full
		// row — so the readout is what this tab shows when no button is pressed,
		// and a button of its own besides.
		id: "orders.statistic",
		label: "Overview",
		labelKey: "menu.dashboard",
		pluralLabel: "Overview",
		pluralLabelKey: "menu.dashboard",
		categories: [Category.Statistic, Category.Business],
	},
] satisfies readonly ObjectDefinition[];

/** The one reference every job operation needs. */
function orderIdOf(references: readonly { kind: string }[]): string {
	const ref = references.find(
		(item: any) => item.kind === "object" && item.type === "orders.order",
	) as { kind: string; id?: string } | undefined;
	if (ref?.kind !== "object" || !ref.id) throw new Error(tr("errors.noOrder"));
	return ref.id;
}

/** Re-read and publish, so every mounted view of this job redraws. */
async function refreshed(id: string) {
	const order = await ordersClient.getOrder(id);
	if (order) orderChanged(order);
	return order;
}

export default defineSurface({
	id: "sf-orders",
	label: "Orders",
	labelKey: "surface.label",
	purpose:
		"The shop floor's queue of production jobs: what is being made, on which machine, by when, and which request it came from",
	purposeKey: "surface.purpose",
	types: objects,
	views: [
		{
			id: "orders.order.detail",
			accepts: objectOf("orders.order"),
			component: OrderDetailView,
			props: (ref) => ({
				orderId: ref.kind === "object" ? ref.id : undefined,
			}),
		},
		{
			id: "orders.order.table",
			label: "Orders",
			accepts: setOf("orders.order"),
			component: EntityListView,
		},
		{
			id: "orders.statistic.dashboard",
			label: "Overview",
			accepts: setOf("orders.statistic"),
			component: OrdersDashboardView,
		},
	],
	operations: [
		{
			id: "orders.order.create",
			operator: "create",
			target: "orders.order",
			label: "Create order",
			labelKey: "operations.create.label",
			description:
				"Put a job on the queue directly. A job that comes from a request is created by converting the request instead, so that the link between the two exists.",
			descriptionKey: "operations.create.description",
			output: objectOf("orders.order"),
			parameters: {
				type: "object",
				properties: orderProperties,
				required: ["modelName", "productionMethod"],
			},
			presentOutput: true,
			invoke: async ({ params }) => {
				const id = await ordersClient.createOrder({
					modelName: String(params.modelName),
					productionMethod: params.productionMethod as never,
					status: "queued",
					quantity: Number(params.quantity ?? 1),
					...(params.material ? { material: String(params.material) } : {}),
					...(params.weightGrams !== undefined
						? { weightGrams: Number(params.weightGrams) }
						: {}),
					...(params.dueAt ? { dueAt: String(params.dueAt) } : {}),
					...(params.notes ? { notes: String(params.notes) } : {}),
					...(params.customerName
						? { customerName: String(params.customerName) }
						: {}),
					...(params.customerEmail
						? { customerEmail: String(params.customerEmail) }
						: {}),
				});
				return objectRef("orders.order", id, {
					title: String(params.modelName),
				});
			},
		},
		{
			id: "orders.order.save",
			operator: "save",
			target: "orders.order",
			label: "Save order",
			labelKey: "operations.save.label",
			inputs: [{ name: "order", accepts: objectOf("orders.order") }],
			parameters: { type: "object", properties: orderProperties },
			invoke: async ({ references, params }) => {
				const id = orderIdOf(references);
				await ordersClient.patchOrder(id, params as never);
				return refreshed(id);
			},
		},
		{
			// The one operators use all day, so it is its own operation rather
			// than a field on the form.
			id: "orders.order.updateStatus",
			operator: "execute",
			target: "orders.order",
			label: "Change status",
			labelKey: "operations.updateStatus.label",
			description:
				"Move a job along: queued, in progress, paused, completed, cancelled or blocked.",
			descriptionKey: "operations.updateStatus.description",
			inputs: [{ name: "order", accepts: objectOf("orders.order") }],
			parameters: {
				type: "object",
				properties: {
					status: { type: "string", enum: [...ORDER_STATUSES] },
				},
				required: ["status"],
			},
			invoke: async ({ references, params }) => {
				const id = orderIdOf(references);
				await ordersClient.updateStatus(id, params.status as OrderStatus);
				return refreshed(id);
			},
		},
		{
			/**
			 * Two writes in two services, composed in the browser.
			 *
			 * Allowed, and deliberately not a workflow: both are plain writes with
			 * nothing to recover between them, and the second one failing leaves a
			 * job assigned but unscheduled — visible on the card, fixed by running
			 * this again. A workflow buys durability that is not needed and costs a
			 * round trip through centimanus on every click.
			 */
			id: "orders.order.assignEquipment",
			operator: "execute",
			target: "orders.order",
			label: "Assign to a machine",
			labelKey: "operations.assign.label",
			description:
				"Put a job on a machine and book the slot in that machine's schedule. Without an end time the job's due date is used; a job with neither has to be told one.",
			descriptionKey: "operations.assign.description",
			inputs: [{ name: "order", accepts: objectOf("orders.order") }],
			parameters: {
				type: "object",
				properties: {
					equipmentId: { type: "string" },
					startAt: {
						type: "string",
						description: "ISO datetime the slot opens; defaults to now",
					},
					endAt: {
						type: "string",
						description:
							"ISO datetime the slot closes; defaults to the due date",
					},
				},
				required: ["equipmentId"],
			},
			invoke: async ({ references, params }) => {
				const id = orderIdOf(references);
				const equipmentId = String(params.equipmentId);
				const order = await ordersClient.getOrder(id);
				const startAt = params.startAt
					? String(params.startAt)
					: new Date().toISOString();
				// No made-up duration: either somebody said when it ends or the job
				// has a due date that says it.
				const endAt = params.endAt
					? String(params.endAt)
					: (order?.dueAt ?? "");
				if (!endAt) throw new Error(tr("errors.noEndAt"));

				await ordersClient.patchOrder(id, { equipmentId });
				await equipmentClient.createScheduleSlot({
					equipmentId,
					orderId: id,
					startAt,
					endAt,
					...(order?.modelName ? { note: order.modelName } : {}),
				});
				return refreshed(id);
			},
		},
	],
});
