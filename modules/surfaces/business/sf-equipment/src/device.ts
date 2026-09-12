import type { Equipment } from "g-equipment";

/**
 * The key this machine's samples arrive under in rp-telemetry.
 *
 * Telemetry rows carry a free-form `device_id` and the equipment record has no
 * field for it yet, so the serial number is the one identifier both sides can
 * plausibly agree on — an adapter reads it off the machine, and a human typed
 * it into the record. The id is the fallback for a machine registered without
 * one, which keeps the card working instead of showing nothing.
 *
 * This is the seam the planned `Equipment.deviceId` migration closes; when it
 * lands, this function reads that field and nothing else changes.
 */
export function deviceKeyOf(
	machine: Equipment | undefined,
): string | undefined {
	if (!machine) return undefined;
	const serial = machine.serialNumber?.trim();
	return serial || machine.id;
}
