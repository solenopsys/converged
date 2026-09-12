import { useUnit } from "effector-preact";
import {
	AlertTriangle,
	Factory,
	Gauge,
	Printer,
	StatisticCard,
	Wrench,
} from "front-core";
import { objectRef, presentReference } from "front-core/object-runtime";
import type { Equipment, EquipmentStatus, ScheduleSlot } from "g-equipment";
import { useEffect, useMemo } from "preact/compat";
import { machineStatusConfig, STATUS_ORDER } from "../config";
import { $floor, equipmentViewMounted } from "../domain-equipment";

// The shop floor at a glance: how many machines there are, what each of them
// is doing right now, and what is booked next. This is the surface's own
// screen — the one shown when no subtab is pressed — so it answers "what is
// happening" and leaves "show me the list" to the projections beside it.

function statusLabel(status: EquipmentStatus): string {
	return machineStatusConfig[status]?.label ?? status;
}

function countOf(
	counts: ReadonlyArray<{ status: EquipmentStatus; count: number }>,
	status: EquipmentStatus,
): number {
	return counts.find((entry) => entry.status === status)?.count ?? 0;
}

function formatTime(value: string): string {
	const date = new Date(value);
	return Number.isNaN(date.getTime())
		? value
		: date.toLocaleString(undefined, {
				day: "2-digit",
				month: "2-digit",
				hour: "2-digit",
				minute: "2-digit",
			});
}

function MachineTile({ machine }: { machine: Equipment }) {
	const status = machine.status;
	const config = machineStatusConfig[status];
	const open = () =>
		void presentReference(
			objectRef("equipment.machine", machine.id, {
				title: machine.name || machine.kind,
			}),
		);

	return (
		<button
			type="button"
			onClick={open}
			class="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-accent"
		>
			<div class="flex items-start justify-between gap-2">
				<span class="truncate text-sm font-medium">
					{machine.name || machine.kind}
				</span>
				<span
					class={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${config?.className ?? ""}`}
				>
					{statusLabel(status)}
				</span>
			</div>
			<div class="text-xs text-muted-foreground">
				{machine.location || machine.kind}
			</div>
			<div class="truncate font-mono text-xs text-muted-foreground">
				{machine.jobId ? `job ${machine.jobId}` : "—"}
			</div>
		</button>
	);
}

function UpcomingRow({ slot }: { slot: ScheduleSlot }) {
	return (
		<div class="flex items-center justify-between gap-3 border-b border-border py-1.5 text-xs last:border-b-0">
			<span class="font-mono text-muted-foreground">
				{formatTime(slot.startAt)}
			</span>
			<span class="flex-1 truncate">{slot.equipmentId}</span>
			<span class="truncate font-mono text-muted-foreground">
				{slot.orderId ?? slot.jobId ?? "—"}
			</span>
		</div>
	);
}

export function EquipmentDashboardView() {
	const floor = useUnit($floor);

	useEffect(() => {
		equipmentViewMounted();
	}, []);

	const counts = floor.dashboard?.statusCounts ?? [];
	// Trouble first: a machine in error or offline is the only thing on this
	// screen that needs someone to walk over to it.
	const attention = useMemo(
		() => countOf(counts, "error") + countOf(counts, "offline"),
		[counts],
	);
	const ordered = useMemo(
		() =>
			[...floor.machines].sort(
				(left, right) =>
					STATUS_ORDER.indexOf(left.status) -
					STATUS_ORDER.indexOf(right.status),
			),
		[floor.machines],
	);

	return (
		<div class="flex flex-col gap-4 p-4">
			<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<StatisticCard
					title="Machines"
					actionKey="equipment.total"
					value={floor.dashboard?.total ?? 0}
					icon={Factory}
					loading={floor.loading}
				/>
				<StatisticCard
					title="Running"
					actionKey="equipment.running"
					value={countOf(counts, "running")}
					description={`${countOf(counts, "idle")} idle`}
					icon={Printer}
					loading={floor.loading}
				/>
				<StatisticCard
					title="Utilization"
					actionKey="equipment.utilization"
					value={`${Math.round(floor.dashboard?.utilizationPercent ?? 0)}%`}
					icon={Gauge}
					loading={floor.loading}
				/>
				<StatisticCard
					title="Needs attention"
					actionKey="equipment.attention"
					value={attention}
					description={`${countOf(counts, "maintenance")} in maintenance`}
					icon={attention > 0 ? AlertTriangle : Wrench}
					loading={floor.loading}
				/>
			</div>

			{floor.error ? (
				<div class="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
					{floor.error}
				</div>
			) : null}

			<section class="flex flex-col gap-2">
				<h2 class="text-sm font-semibold">Floor</h2>
				{ordered.length === 0 ? (
					<p class="text-sm text-muted-foreground">
						{floor.loading ? "Loading…" : "No machines registered yet."}
					</p>
				) : (
					<div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
						{ordered.map((machine) => (
							<MachineTile key={machine.id} machine={machine} />
						))}
					</div>
				)}
			</section>

			<section class="flex flex-col gap-2">
				<h2 class="text-sm font-semibold">Next up</h2>
				{floor.upcoming.length === 0 ? (
					<p class="text-sm text-muted-foreground">Nothing scheduled.</p>
				) : (
					<div class="rounded-lg border border-border bg-card px-3 py-1">
						{floor.upcoming.slice(0, 8).map((slot) => (
							<UpcomingRow key={slot.id} slot={slot} />
						))}
					</div>
				)}
			</section>
		</div>
	);
}

export default EquipmentDashboardView;
