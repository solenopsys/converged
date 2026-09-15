// wf-equipment-incident — a machine goes down, and the work booked on it has to
// find out.
//
// Four services move together and none of them may call the others. rp-equipment
// does not know what an order is, rp-orders does not know which machine is
// broken, rp-events and pushrouter know about neither — so "the printer is in
// error, therefore its running slot is off and the job on it is blocked" can
// only be written from here.
//
// Two ways in, one script. Today the operator standing at the machine reports
// it (`equipment.machine.set-state` with status `error` runs this); once the
// hardware bridge exists, a bus trigger on `equipment.state.changed.<id>` runs
// the same thing. That is why the machine's state is set here and not by the
// caller: the incident is one fact, whoever noticed it.
//
// What it deliberately does not do: move future bookings. A slot that starts
// tomorrow may be fine once the nozzle is swapped, and whether to wait or
// re-plan is the shop's decision — so those are counted as at risk and shown,
// not cancelled.

import "dag-core/env";

import { createEquipmentServiceRtClient } from "g-equipment/rt";
import { createEventsServiceRtClient } from "g-events/rt";
import { createOrdersServiceRtClient } from "g-orders/rt";
import { createPushRouterServiceRtClient } from "g-pushrouter/rt";

const equipment = createEquipmentServiceRtClient();
const events = createEventsServiceRtClient();
const orders = createOrdersServiceRtClient();
const push = createPushRouterServiceRtClient();

const SEVERITIES = ["warning", "error", "critical"];

/** Orders past the point where a broken machine changes anything. */
const SETTLED_ORDER = new Set(["completed", "cancelled", "blocked"]);

/** More than a floor books on one machine; paging past it is not worth a loop. */
const SLOT_PAGE = 200;

type Input = {
	equipmentId: string;
	/** What happened, in the reporter's words. Lands in the journal as is. */
	description?: string;
	severity?: string;
	/** Report without touching slots, orders or anyone's screen. */
	dryRun?: boolean;
};

type Slot = {
	id: string;
	orderId?: string;
	startAt: string | Date;
	endAt: string | Date;
	status: string;
};

/**
 * Milliseconds of a timestamp, whatever shape it crossed the VM boundary in.
 * The runtime revives ISO strings in service replies as `Date`, and a `Date`
 * compared with a string is `NaN` — every comparison false, silently.
 */
function ms(value: string | Date): number {
	return value instanceof Date ? value.getTime() : Date.parse(String(value));
}

/** Running now: marked in progress, or planned for a window that includes now. */
function isActive(slot: Slot, now: number): boolean {
	if (slot.status === "in_progress") return true;
	return (
		slot.status === "planned" && ms(slot.startAt) <= now && now < ms(slot.endAt)
	);
}

rt.workflow = (input: Input) => {
	const equipmentId = String(input?.equipmentId ?? "").trim();
	if (!equipmentId)
		throw new Error("equipment-incident requires params.equipmentId");
	const severity = SEVERITIES.includes(String(input.severity))
		? String(input.severity)
		: "error";
	const dryRun = input.dryRun === true;

	// The clock is read once and replayed: a resumed run must decide "active"
	// against the same moment the first attempt did.
	const now = ms(rt.node("clock", () => new Date().toISOString()));

	// ---- 1. the machine ------------------------------------------------------
	const machine = rt.node(`read-machine:${equipmentId}`, () =>
		equipment.getEquipment(equipmentId),
	);
	if (!machine) throw new Error(`machine not found: ${equipmentId}`);
	const label = String(machine.name || machine.kind || equipmentId);
	const description =
		String(input.description ?? "").trim() || `${label} reported an error`;

	// ---- 2. the slots it was running ----------------------------------------
	const schedule = rt.node(`read-schedule:${equipmentId}`, () =>
		equipment.listSchedule({ offset: 0, limit: SLOT_PAGE, equipmentId }),
	);
	const slots = (schedule?.items ?? []) as Slot[];
	const active = slots.filter((slot) => isActive(slot, now));
	const atRisk = slots.filter(
		(slot) => slot.status === "planned" && ms(slot.startAt) > now,
	);

	const affected = [
		...new Set(active.map((slot) => slot.orderId).filter(Boolean)),
	] as string[];

	const errors: { stage: string; id?: string; message: string }[] = [];
	const cancelledSlots: string[] = [];
	const blockedOrders: string[] = [];

	if (!dryRun) {
		// ---- 3. the machine's state and the journal ---------------------------
		// State first: it is what the floor screen shows, and a failure below
		// must not leave a broken machine looking idle.
		if (machine.status !== "error") {
			const stated = rt.attempt(`set-state:${equipmentId}`, () =>
				equipment.updateState(equipmentId, { status: "error" }),
			);
			if (!stated.ok) throw new Error(stated.error);
		}

		const logged = rt.attempt(`log-incident:${equipmentId}`, () =>
			equipment.addLog({
				equipmentId,
				eventType: "incident",
				severity: severity as any,
				description,
			}),
		);
		if (!logged.ok) errors.push({ stage: "log", message: logged.error });

		// ---- 4. release the machine, block the work --------------------------
		// Each slot on its own attempt: one that fails to cancel is a line in
		// the report, not a reason to leave the rest of the floor uninformed.
		for (const slot of active) {
			const cancelled = rt.attempt(`cancel-slot:${slot.id}`, () =>
				equipment.patchScheduleSlot(slot.id, {
					status: "cancelled",
					note: `Incident: ${description}`,
				}),
			);
			if (!cancelled.ok) {
				errors.push({ stage: "slot", id: slot.id, message: cancelled.error });
				continue;
			}
			cancelledSlots.push(slot.id);
		}

		for (const orderId of affected) {
			const order = rt.node(`read-order:${orderId}`, () =>
				orders.getOrder(orderId),
			);
			if (!order || SETTLED_ORDER.has(String(order.status))) continue;
			const blocked = rt.attempt(`block-order:${orderId}`, () =>
				orders.updateStatus(orderId, "blocked"),
			);
			if (!blocked.ok) {
				errors.push({ stage: "order", id: orderId, message: blocked.error });
				continue;
			}
			blockedOrders.push(orderId);
		}

		// ---- 5. tell the floor -----------------------------------------------
		const journaled = rt.attempt(`publish-event:${equipmentId}`, () =>
			events.publish({
				type: "equipment.incident",
				service: "equipment",
				entityId: equipmentId,
				label: description,
			}),
		);
		if (!journaled.ok)
			errors.push({ stage: "event", message: journaled.error });

		// Everyone in the workspace: there is no "who is on shift" to address
		// yet, and an incident nobody sees is the failure this exists to stop.
		const notified = rt.attempt(`notify:${equipmentId}`, () =>
			push.publish({
				name: "equipment.incident",
				level: "error",
				title: label,
				body: description,
				params: {
					blockedOrders: blockedOrders.length,
					atRisk: atRisk.length,
				},
				link: { surface: "equipment", ref: equipmentId },
			}),
		);
		if (!notified.ok) errors.push({ stage: "notify", message: notified.error });
	}

	const result = {
		status: dryRun ? "dry-run" : "reported",
		equipmentId,
		machine: label,
		severity,
		cancelledSlots: dryRun ? active.map((slot) => slot.id) : cancelledSlots,
		blockedOrders,
		/** Orders on the slots that were running — what a dry run would block. */
		affectedOrders: affected,
		atRiskSlots: atRisk.map((slot) => ({
			id: slot.id,
			orderId: slot.orderId,
			startAt: new Date(ms(slot.startAt)).toISOString(),
		})),
		errors,
	};
	rt.log(
		`equipment-incident: ${equipmentId} (${severity}) — ${cancelledSlots.length} slot(s) off, ${blockedOrders.length} order(s) blocked, ${atRisk.length} at risk`,
	);
	return result;
};
