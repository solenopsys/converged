import { createDomain, sample } from "effector";
import type {
	Equipment,
	EquipmentDashboard,
	EquipmentLog,
	EquipmentStatus,
	ScheduleSlot,
} from "g-equipment";
import type { Order } from "g-orders";
import type { TelemetryEvent } from "g-telemetry";
import { deviceKeyOf } from "./device";
import { equipmentClient, ordersClient, telemetryClient } from "./services";

const domain = createDomain("sf-equipment");

export const equipmentViewMounted = domain.createEvent(
	"EQUIPMENT_VIEW_MOUNTED",
);
export const refreshClicked = domain.createEvent("EQUIPMENT_REFRESH_CLICKED");
export const machineOpened = domain.createEvent<{ machineId: string }>(
	"EQUIPMENT_MACHINE_OPENED",
);
export const machineChanged = domain.createEvent<Equipment>(
	"EQUIPMENT_MACHINE_CHANGED",
);

// ---- shop floor dashboard ---------------------------------------------------

/** The floor overview: how many machines, in which states, and what is booked
 * next. Three reads rather than one, because the schedule and the fleet are
 * separate stores and this view is the only place that wants both. */
export const loadFloorFx = domain.createEffect({
	name: "LOAD_EQUIPMENT_FLOOR",
	handler: async (): Promise<{
		dashboard: EquipmentDashboard;
		machines: Equipment[];
		upcoming: ScheduleSlot[];
	}> => {
		const now = new Date().toISOString();
		const [dashboard, machines, upcoming] = await Promise.all([
			equipmentClient.getEquipmentDashboard(),
			equipmentClient.listEquipment({ offset: 0, limit: 200 }),
			equipmentClient.listSchedule({ offset: 0, limit: 50, from: now }),
		]);
		return {
			dashboard,
			machines: machines.items ?? [],
			upcoming: upcoming.items ?? [],
		};
	},
});

export type FloorState = {
	dashboard?: EquipmentDashboard;
	machines: Equipment[];
	upcoming: ScheduleSlot[];
	loading: boolean;
	error?: string;
};

export const $floor = domain
	.createStore<FloorState>(
		{ machines: [], upcoming: [], loading: false },
		{ name: "EQUIPMENT_FLOOR" },
	)
	.on(loadFloorFx, (state) => ({ ...state, loading: true, error: undefined }))
	.on(loadFloorFx.doneData, (state, data) => ({
		...state,
		...data,
		loading: false,
	}))
	.on(loadFloorFx.failData, (state, error) => ({
		...state,
		loading: false,
		error: error.message,
	}))
	// A machine edited in its card must not leave the floor list stale behind it.
	.on(machineChanged, (state, machine) => ({
		...state,
		machines: state.machines.map((entry) =>
			entry.id === machine.id ? machine : entry,
		),
	}));

sample({ clock: [equipmentViewMounted, refreshClicked], target: loadFloorFx });

// ---- one machine ------------------------------------------------------------

/** How many samples back the card looks. Enough for a temperature curve to
 * have a shape, small enough that opening a card is not a query over the day. */
const TELEMETRY_WINDOW = 400;

export type MachineState = {
	machineId?: string;
	machine?: Equipment;
	order?: Order;
	logs: EquipmentLog[];
	slots: ScheduleSlot[];
	samples: TelemetryEvent[];
	loading: boolean;
	error?: string;
};

export const loadMachineFx = domain.createEffect({
	name: "LOAD_EQUIPMENT_MACHINE",
	handler: async (
		machineId: string,
	): Promise<Omit<MachineState, "loading" | "error">> => {
		const machine = await equipmentClient.getEquipment(machineId);
		const [logs, slots] = await Promise.all([
			equipmentClient.listLogs({
				offset: 0,
				limit: 50,
				equipmentId: machineId,
			}),
			equipmentClient.listSchedule({
				offset: 0,
				limit: 50,
				equipmentId: machineId,
			}),
		]);

		// Both of these are about a machine but owned by other services, and
		// either can be absent without the card being broken: a machine may run
		// no job, and a fleet may have no telemetry bridge yet.
		const deviceId = deviceKeyOf(machine);
		const samples = deviceId
			? await telemetryClient
					.listHot({ offset: 0, limit: TELEMETRY_WINDOW, device_id: deviceId })
					.then((page) => page.items ?? [])
					.catch(() => [])
			: [];
		const order = machine?.jobId
			? await ordersClient.getOrder(machine.jobId).catch(() => undefined)
			: undefined;

		return {
			machineId,
			machine,
			order: order ?? undefined,
			logs: logs.items ?? [],
			slots: slots.items ?? [],
			samples,
		};
	},
});

export const $machine = domain
	.createStore<MachineState>(
		{ logs: [], slots: [], samples: [], loading: false },
		{ name: "EQUIPMENT_MACHINE" },
	)
	.on(machineOpened, (state, { machineId }) =>
		state.machineId === machineId
			? state
			: { machineId, logs: [], slots: [], samples: [], loading: true },
	)
	.on(loadMachineFx, (state) => ({ ...state, loading: true, error: undefined }))
	.on(loadMachineFx.doneData, (state, data) => ({
		...state,
		...data,
		loading: false,
	}))
	.on(loadMachineFx.failData, (state, error) => ({
		...state,
		loading: false,
		error: error.message,
	}));

sample({
	clock: machineOpened,
	fn: ({ machineId }) => machineId,
	target: loadMachineFx,
});

/** Refresh re-reads whichever machine is open, not just the floor. */
sample({
	clock: refreshClicked,
	source: $machine,
	filter: (state): state is MachineState & { machineId: string } =>
		Boolean(state.machineId),
	fn: (state) => state.machineId as string,
	target: loadMachineFx,
});

// ---- writes -----------------------------------------------------------------

export const setStateFx = domain.createEffect({
	name: "SET_EQUIPMENT_STATE",
	handler: async (input: {
		id: string;
		status: EquipmentStatus;
		jobId?: string;
	}) => {
		await equipmentClient.updateState(input.id, {
			status: input.status,
			...(input.jobId ? { jobId: input.jobId } : {}),
		});
		return input.id;
	},
});

// A state change is the one write whose result the whole surface cares about:
// the card shows it, the floor counts it, and the schedule reads from it.
sample({ clock: setStateFx.doneData, target: loadMachineFx });
sample({ clock: setStateFx.done, target: loadFloorFx });

// ---- derived ----------------------------------------------------------------

/** The latest value of every parameter this machine reports.
 *
 * Telemetry comes back newest first, so the first row seen for a parameter is
 * its current value — no sorting, no per-parameter query. */
export function latestParameters(
	samples: readonly TelemetryEvent[],
): Array<{ param: string; value: number; unit: string; ts: number }> {
	const latest = new Map<
		string,
		{ param: string; value: number; unit: string; ts: number }
	>();
	for (const sample of samples) {
		const known = latest.get(sample.param);
		if (known && known.ts >= sample.ts) continue;
		latest.set(sample.param, {
			param: sample.param,
			value: sample.value,
			unit: sample.unit,
			ts: sample.ts,
		});
	}
	return [...latest.values()].sort((left, right) =>
		left.param.localeCompare(right.param),
	);
}

/** One parameter's series, oldest first, for a line. */
export function seriesOf(
	samples: readonly TelemetryEvent[],
	param: string,
): TelemetryEvent[] {
	return samples
		.filter((sample) => sample.param === param)
		.sort((left, right) => left.ts - right.ts);
}
