import { useUnit } from "effector-preact";
import { Sparkline } from "front-core";
import { objectRef, presentReference } from "front-core/object-runtime";
import type { EquipmentStatus } from "g-equipment";
import type { Order } from "g-orders";
import { useEffect, useMemo } from "preact/compat";
import {
	logSeverityConfig,
	machineStatusConfig,
	slotStatusConfig,
} from "../config";
import { deviceKeyOf } from "../device";
import {
	$machine,
	latestParameters,
	machineOpened,
	seriesOf,
	setStateFx,
} from "../domain-equipment";

// One machine, as the floor asks about it: what state is it in, what is it
// running, what are its numbers doing, what happened to it lately, and what is
// booked on it next. It opens as a subtab of this surface, so the operator is
// still inside "equipment" while reading it.

const STATES: EquipmentStatus[] = [
	"running",
	"idle",
	"maintenance",
	"error",
	"offline",
];

/** Parameters an operator looks at first; everything else follows alphabetically. */
const LEADING_PARAMS = ["temperature", "bed_temperature", "progress", "speed"];

function formatDate(value: string | undefined): string {
	if (!value) return "—";
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatSampleTime(ts: number): string {
	// Telemetry timestamps are seconds in the ingest path and milliseconds
	// nowhere yet; treat anything below year 2100 in seconds as seconds.
	const date = new Date(ts < 4_102_444_800 ? ts * 1000 : ts);
	return Number.isNaN(date.getTime()) ? String(ts) : date.toLocaleTimeString();
}

function Field({ label, value }: { label: string; value: unknown }) {
	return (
		<div class="flex flex-col gap-0.5">
			<span class="text-[11px] uppercase tracking-wide text-muted-foreground">
				{label}
			</span>
			<span class="text-sm">
				{value === undefined || value === null || value === ""
					? "—"
					: String(value)}
			</span>
		</div>
	);
}

/** The order this machine is running, as a way into that order. Taking it as a
 * prop is what narrows it: the caller has already decided there is one. */
function CurrentJob({ order }: { order: Order }) {
	return (
		<button
			type="button"
			onClick={() =>
				void presentReference(
					objectRef("orders.order", order.id, { title: order.modelName }),
				)
			}
			class="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-accent"
		>
			<Field label="Order" value={order.modelName} />
			<Field label="Method" value={order.productionMethod} />
			<Field label="Quantity" value={order.quantity} />
			<Field label="Material" value={order.material} />
			<Field label="Due" value={formatDate(order.dueAt)} />
		</button>
	);
}

export function MachineDetailView({ machineId }: { machineId?: string }) {
	const state = useUnit($machine);
	const pending = useUnit(setStateFx.pending);

	useEffect(() => {
		if (machineId) machineOpened({ machineId });
	}, [machineId]);

	const machine = state.machine;
	const params = useMemo(
		() => latestParameters(state.samples),
		[state.samples],
	);
	const ordered = useMemo(() => {
		const rank = (name: string) => {
			const index = LEADING_PARAMS.indexOf(name);
			return index === -1 ? LEADING_PARAMS.length : index;
		};
		return [...params].sort(
			(left, right) =>
				rank(left.param) - rank(right.param) ||
				left.param.localeCompare(right.param),
		);
	}, [params]);

	if (!machineId) {
		return (
			<div class="p-4 text-sm text-muted-foreground">No machine selected.</div>
		);
	}
	if (state.loading && !machine) {
		return <div class="p-4 text-sm text-muted-foreground">Loading…</div>;
	}
	if (state.error) {
		return <div class="p-4 text-sm text-rose-700">{state.error}</div>;
	}
	if (!machine) {
		return (
			<div class="p-4 text-sm text-muted-foreground">Machine not found.</div>
		);
	}

	const statusStyle = machineStatusConfig[machine.status];

	return (
		<div class="flex flex-col gap-4 p-4">
			<header class="flex flex-wrap items-center gap-3">
				<h1 class="text-lg font-semibold">{machine.name || machine.kind}</h1>
				<span
					class={`rounded px-2 py-0.5 text-xs font-medium ${statusStyle?.className ?? ""}`}
				>
					{statusStyle?.label ?? machine.status}
				</span>
				<span class="font-mono text-xs text-muted-foreground">
					{deviceKeyOf(machine)}
				</span>
			</header>

			{/* A state change is a write the operator makes from here, because the
			    machine in front of them is the source of truth until a bridge
			    reports it automatically. */}
			<section class="flex flex-wrap items-center gap-2">
				{STATES.map((status) => (
					<button
						key={status}
						type="button"
						disabled={pending || status === machine.status}
						onClick={() => setStateFx({ id: machine.id, status })}
						class="rounded border border-border px-2.5 py-1 text-xs transition-colors hover:bg-accent disabled:opacity-40"
					>
						{machineStatusConfig[status]?.label ?? status}
					</button>
				))}
			</section>

			<section class="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-3 md:grid-cols-4">
				<Field label="Kind" value={machine.kind} />
				<Field label="Location" value={machine.location} />
				<Field label="Serial" value={machine.serialNumber} />
				<Field
					label="Last service"
					value={formatDate(machine.lastMaintenanceAt)}
				/>
			</section>

			<section class="flex flex-col gap-2">
				<h2 class="text-sm font-semibold">Current job</h2>
				{state.order ? (
					<CurrentJob order={state.order} />
				) : (
					<p class="text-sm text-muted-foreground">
						{machine.jobId
							? `Job ${machine.jobId} is not an order in this workspace.`
							: "Not running anything."}
					</p>
				)}
			</section>

			<section class="flex flex-col gap-2">
				<h2 class="text-sm font-semibold">Live parameters</h2>
				{ordered.length === 0 ? (
					<p class="text-sm text-muted-foreground">
						No telemetry for this machine yet.
					</p>
				) : (
					<div class="grid grid-cols-1 gap-2 md:grid-cols-2">
						{ordered.map((entry) => {
							const series = seriesOf(state.samples, entry.param);
							return (
								<div
									key={entry.param}
									class="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
								>
									<div class="flex flex-col gap-0.5">
										<span class="text-[11px] uppercase tracking-wide text-muted-foreground">
											{entry.param}
										</span>
										<span class="text-base font-medium">
											{entry.value}
											{entry.unit ? ` ${entry.unit}` : ""}
										</span>
										<span class="text-[11px] text-muted-foreground">
											{formatSampleTime(entry.ts)}
										</span>
									</div>
									{series.length > 1 ? (
										<Sparkline
											values={series.map((point) => point.value)}
											label={entry.param}
										/>
									) : null}
								</div>
							);
						})}
					</div>
				)}
			</section>

			<section class="flex flex-col gap-2">
				<h2 class="text-sm font-semibold">Schedule</h2>
				{state.slots.length === 0 ? (
					<p class="text-sm text-muted-foreground">Nothing booked.</p>
				) : (
					<div class="rounded-lg border border-border bg-card px-3 py-1">
						{state.slots.map((slot) => (
							<div
								key={slot.id}
								class="flex items-center justify-between gap-3 border-b border-border py-1.5 text-xs last:border-b-0"
							>
								<span class="font-mono text-muted-foreground">
									{formatDate(slot.startAt)}
								</span>
								<span
									class={`rounded px-1.5 py-0.5 text-[11px] ${slotStatusConfig[slot.status]?.className ?? ""}`}
								>
									{slotStatusConfig[slot.status]?.label ?? slot.status}
								</span>
								<span class="flex-1 truncate font-mono text-muted-foreground">
									{slot.orderId ?? slot.jobId ?? "—"}
								</span>
							</div>
						))}
					</div>
				)}
			</section>

			<section class="flex flex-col gap-2">
				<h2 class="text-sm font-semibold">Journal</h2>
				{state.logs.length === 0 ? (
					<p class="text-sm text-muted-foreground">Nothing logged.</p>
				) : (
					<div class="rounded-lg border border-border bg-card px-3 py-1">
						{state.logs.map((entry) => (
							<div
								key={entry.id}
								class="flex items-start gap-3 border-b border-border py-1.5 text-xs last:border-b-0"
							>
								<span class="w-32 shrink-0 font-mono text-muted-foreground">
									{formatDate(entry.createdAt)}
								</span>
								<span
									class={`shrink-0 rounded px-1.5 py-0.5 text-[11px] ${logSeverityConfig[entry.severity]?.className ?? ""}`}
								>
									{logSeverityConfig[entry.severity]?.label ?? entry.severity}
								</span>
								<span class="flex-1">{entry.description}</span>
							</div>
						))}
					</div>
				)}
			</section>
		</div>
	);
}

export default MachineDetailView;
