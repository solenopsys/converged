import type { Equipment } from "g-equipment";

/**
 * The key this machine's samples arrive under in rp-telemetry.
 *
 * `deviceId` is the record's own answer and the only one that is stated rather
 * than inferred. The serial number stays as the fallback because it is what
 * the guess used to be, and a shop that has been sending samples keyed by
 * serial keeps its charts while the field is filled in; the id is the last
 * resort, which keeps the card working instead of showing nothing.
 */
export function deviceKeyOf(
	machine: Equipment | undefined,
): string | undefined {
	if (!machine) return undefined;
	const device = machine.deviceId?.trim();
	if (device) return device;
	const serial = machine.serialNumber?.trim();
	return serial || machine.id;
}
