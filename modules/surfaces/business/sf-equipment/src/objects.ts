import { EntityListView } from "front-core";
import {
	Category,
	defineSurface,
	type ObjectDefinition,
	objectOf,
	objectRef,
	setOf,
} from "front-core/object-runtime";
import type {
	EquipmentListParams,
	EquipmentLogListParams,
	EquipmentStatus,
	ScheduleListParams,
} from "g-equipment";
import { logColumns, machineColumns, slotColumns } from "./config";
import { machineChanged } from "./domain-equipment";
import { equipmentClient } from "./services";
import { EquipmentSummary } from "./summary";
import { EquipmentDashboardView } from "./views/EquipmentDashboardView";
import { MachineDetailView } from "./views/MachineDetailView";

// Equipment as one working area.
//
// Three `setOf` views — machines, journal, schedule — which the workspace turns
// into the permanent buttons of this tab, and one `objectOf` view for a
// machine, which opens as a closable button *inside the same tab*. Clicking a
// printer therefore never leaves "equipment": that is the whole point of the
// two levels, and the reason this surface declares a screen of its own
// (`EquipmentDashboardView`) for the state where nothing is pressed.

const STATUS_OPTIONS: Array<{ value: EquipmentStatus; label: string }> = [
	{ value: "running", label: "Running" },
	{ value: "idle", label: "Idle" },
	{ value: "maintenance", label: "Maintenance" },
	{ value: "error", label: "Error" },
	{ value: "offline", label: "Offline" },
];

const machineProperties = {
	kind: {
		type: "string",
		description:
			"Machine family as the shop names it: fdm, sla, cnc, laser, robot",
	},
	name: { type: "string", description: "Human name on the floor" },
	serialNumber: { type: "string" },
	location: { type: "string", description: "Where it physically stands" },
	description: { type: "string" },
	maintenanceIntervalDays: { type: "number" },
};

export const objects = [
	{
		id: "equipment.machine",
		label: "Machine",
		pluralLabel: "Equipment",
		description:
			"One physical machine on the floor: its state, the job it runs, its parameters",
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
					label: "Status",
					valueType: "string",
					operators: ["eq", "in"],
					control: "select",
					options: STATUS_OPTIONS.map((option) => ({
						id: option.value,
						label: option.label,
					})),
				},
				{
					id: "kind",
					label: "Kind",
					valueType: "string",
					operators: ["eq", "in"],
				},
			],
			load: (params) => equipmentClient.listEquipment(params),
		},
		infinity: {
			tableId: "equipment",
			title: "Equipment",
			columns: machineColumns,
			load: (params) =>
				equipmentClient.listEquipment(params as EquipmentListParams),
			rowRef: (row) => {
				const machine = row as {
					id?: unknown;
					name?: unknown;
					kind?: unknown;
				};
				const id = String(machine.id ?? "");
				return objectRef("equipment.machine", id, {
					title:
						(typeof machine.name === "string" && machine.name) ||
						(typeof machine.kind === "string" && machine.kind) ||
						id,
				});
			},
			filters: [
				{
					id: "status",
					label: "Status",
					type: "select",
					operator: "eq",
					options: STATUS_OPTIONS.map((option) => ({
						value: option.value,
						label: option.label,
					})),
				},
				{ id: "kind", label: "Kind", type: "search", operator: "contains" },
				{ id: "jobId", label: "Job", type: "search", operator: "eq" },
			],
			// Working, free, then trouble — the order the floor is read in.
			presets: [
				{
					id: "equipment.all",
					label: "All",
					control: "tab",
					group: "equipment-status",
				},
				{
					id: "equipment.running",
					label: "Running",
					control: "tab",
					group: "equipment-status",
					defaults: { status: "running" },
				},
				{
					id: "equipment.attention",
					label: "Needs attention",
					control: "tab",
					group: "equipment-status",
					defaults: { status: "error" },
				},
			],
			mobile: { title: "name", subtitle: "location", badge: "status" },
		},
	},
	{
		id: "equipment.log",
		label: "Machine event",
		pluralLabel: "Journal",
		description: "What happened to a machine: incidents, service, job starts",
		categories: [Category.Business, Category.Selectable],
		selection: {
			filters: [],
			load: (params) => equipmentClient.listLogs(params),
		},
		infinity: {
			tableId: "equipment-logs",
			title: "Journal",
			columns: logColumns,
			load: (params) =>
				equipmentClient.listLogs(params as EquipmentLogListParams),
			rowRef: (row) => {
				const entry = row as { equipmentId?: unknown };
				return objectRef("equipment.machine", String(entry.equipmentId ?? ""));
			},
			filters: [
				{
					id: "equipmentId",
					label: "Machine",
					type: "search",
					operator: "eq",
				},
				{
					id: "severity",
					label: "Severity",
					type: "select",
					operator: "eq",
					options: [
						{ value: "info", label: "Info" },
						{ value: "warning", label: "Warning" },
						{ value: "error", label: "Error" },
						{ value: "critical", label: "Critical" },
					],
				},
				{
					id: "eventType",
					label: "Event",
					type: "select",
					operator: "eq",
					options: [
						{ value: "status_change", label: "Status change" },
						{ value: "maintenance", label: "Maintenance" },
						{ value: "incident", label: "Incident" },
						{ value: "note", label: "Note" },
						{ value: "job_start", label: "Job start" },
						{ value: "job_end", label: "Job end" },
					],
				},
			],
		},
	},
	{
		id: "equipment.slot",
		label: "Schedule slot",
		pluralLabel: "Schedule",
		description: "A booked window on one machine, usually for one order",
		categories: [Category.Business, Category.Selectable, Category.Creatable],
		selection: {
			filters: [],
			load: (params) => equipmentClient.listSchedule(params),
		},
		infinity: {
			tableId: "equipment-schedule",
			title: "Schedule",
			columns: slotColumns,
			load: (params) =>
				equipmentClient.listSchedule(params as ScheduleListParams),
			rowRef: (row) => {
				const slot = row as { equipmentId?: unknown };
				return objectRef("equipment.machine", String(slot.equipmentId ?? ""));
			},
			filters: [
				{
					id: "equipmentId",
					label: "Machine",
					type: "search",
					operator: "eq",
				},
				{
					id: "status",
					label: "Status",
					type: "select",
					operator: "eq",
					options: [
						{ value: "planned", label: "Planned" },
						{ value: "in_progress", label: "In progress" },
						{ value: "completed", label: "Completed" },
						{ value: "cancelled", label: "Cancelled" },
					],
				},
			],
		},
	},
	{
		id: "equipment.statistic.summary",
		label: "Equipment",
		categories: [Category.Statistic, Category.Business],
		statistic: { role: "summary", component: EquipmentSummary },
	},
	{
		// The surface's own screen. A statistical type with no `component` is
		// resolved through its `setOf` view, which the shell then gives the full
		// row — so the floor overview is what this tab shows when no button is
		// pressed, and a button of its own besides.
		id: "equipment.statistic",
		label: "Floor",
		pluralLabel: "Floor",
		categories: [Category.Statistic, Category.Business],
	},
] satisfies readonly ObjectDefinition[];

export default defineSurface({
	id: "sf-equipment",
	label: "Equipment",
	purpose:
		"Machines on the shop floor: their state, the jobs they run, their journal and schedule",
	types: objects,
	views: [
		{
			id: "equipment.machine.detail",
			accepts: objectOf("equipment.machine"),
			component: MachineDetailView,
			props: (ref) => ({
				machineId: ref.kind === "object" ? ref.id : undefined,
			}),
		},
		{
			id: "equipment.machine.table",
			label: "Equipment",
			accepts: setOf("equipment.machine"),
			component: EntityListView,
		},
		{
			id: "equipment.log.table",
			label: "Journal",
			accepts: setOf("equipment.log"),
			component: EntityListView,
		},
		{
			id: "equipment.slot.table",
			label: "Schedule",
			accepts: setOf("equipment.slot"),
			component: EntityListView,
		},
		{
			id: "equipment.statistic.dashboard",
			label: "Floor",
			accepts: setOf("equipment.statistic"),
			component: EquipmentDashboardView,
		},
	],
	operations: [
		{
			id: "equipment.machine.create",
			operator: "create",
			target: "equipment.machine",
			label: "Register machine",
			description:
				"Add a machine to the floor. Kind is required; everything else can follow.",
			output: objectOf("equipment.machine"),
			parameters: {
				type: "object",
				properties: machineProperties,
				required: ["kind"],
			},
			presentOutput: true,
			invoke: async ({ params }) => {
				const id = await equipmentClient.registerEquipment(params as never);
				return objectRef("equipment.machine", id, {
					title: (params.name as string) || (params.kind as string),
				});
			},
		},
		{
			id: "equipment.machine.save",
			operator: "save",
			target: "equipment.machine",
			label: "Save machine",
			inputs: [{ name: "machine", accepts: objectOf("equipment.machine") }],
			parameters: { type: "object", properties: machineProperties },
			invoke: async ({ references, params }) => {
				const ref = references.find(
					(item) => item.kind === "object" && item.type === "equipment.machine",
				);
				if (ref?.kind !== "object")
					throw new Error("Machine reference is required");
				await equipmentClient.patchEquipment(ref.id, params as never);
				const machine = await equipmentClient.getEquipment(ref.id);
				if (machine) machineChanged(machine);
				return machine;
			},
		},
		{
			// Until a bridge reports it, the operator standing next to the machine
			// is the only source of its state — so this is an ordinary operation
			// rather than something only an adapter may call.
			id: "equipment.machine.set-state",
			operator: "execute",
			target: "equipment.machine",
			label: "Set machine state",
			description:
				"Mark a machine as running, idle, in maintenance, in error or offline",
			inputs: [{ name: "machine", accepts: objectOf("equipment.machine") }],
			parameters: {
				type: "object",
				properties: {
					status: {
						type: "string",
						enum: STATUS_OPTIONS.map((option) => option.value),
					},
					jobId: {
						type: "string",
						description: "Order or job the machine is running, when it is",
					},
				},
				required: ["status"],
			},
			invoke: async ({ references, params }) => {
				const ref = references.find(
					(item) => item.kind === "object" && item.type === "equipment.machine",
				);
				if (ref?.kind !== "object")
					throw new Error("Machine reference is required");
				await equipmentClient.updateState(ref.id, {
					status: params.status as EquipmentStatus,
					...(params.jobId ? { jobId: params.jobId as string } : {}),
				});
				const machine = await equipmentClient.getEquipment(ref.id);
				if (machine) machineChanged(machine);
			},
		},
		{
			id: "equipment.log.create",
			operator: "add",
			target: "equipment.log",
			label: "Log machine event",
			inputs: [{ name: "machine", accepts: objectOf("equipment.machine") }],
			parameters: {
				type: "object",
				properties: {
					description: { type: "string" },
					eventType: {
						type: "string",
						enum: [
							"status_change",
							"maintenance",
							"incident",
							"note",
							"job_start",
							"job_end",
						],
					},
					severity: {
						type: "string",
						enum: ["info", "warning", "error", "critical"],
					},
				},
				required: ["description"],
			},
			invoke: async ({ references, params }) => {
				const ref = references.find(
					(item) => item.kind === "object" && item.type === "equipment.machine",
				);
				if (ref?.kind !== "object")
					throw new Error("Machine reference is required");
				return equipmentClient.addLog({
					equipmentId: ref.id,
					eventType: (params.eventType as never) ?? "note",
					severity: (params.severity as never) ?? "info",
					description: String(params.description ?? ""),
				});
			},
		},
		{
			id: "equipment.slot.create",
			operator: "create",
			target: "equipment.slot",
			label: "Book a slot",
			description: "Reserve a window on a machine, optionally for an order",
			inputs: [{ name: "machine", accepts: objectOf("equipment.machine") }],
			parameters: {
				type: "object",
				properties: {
					startAt: { type: "string", description: "ISO-8601 start" },
					endAt: { type: "string", description: "ISO-8601 end" },
					orderId: { type: "string" },
					note: { type: "string" },
				},
				required: ["startAt", "endAt"],
			},
			invoke: async ({ references, params }) => {
				const ref = references.find(
					(item) => item.kind === "object" && item.type === "equipment.machine",
				);
				if (ref?.kind !== "object")
					throw new Error("Machine reference is required");
				return equipmentClient.createScheduleSlot({
					equipmentId: ref.id,
					startAt: String(params.startAt),
					endAt: String(params.endAt),
					...(params.orderId ? { orderId: String(params.orderId) } : {}),
					...(params.note ? { note: String(params.note) } : {}),
				});
			},
		},
		{
			id: "equipment.machine.delete",
			operator: "delete",
			target: "equipment.machine",
			label: "Remove machine",
			inputs: [{ name: "machine", accepts: objectOf("equipment.machine") }],
			invoke: async ({ references }) => {
				const ref = references.find(
					(item) => item.kind === "object" && item.type === "equipment.machine",
				);
				if (ref?.kind !== "object")
					throw new Error("Machine reference is required");
				return equipmentClient.deleteEquipment(ref.id);
			},
		},
	],
});
