import { describe, expect, test } from "bun:test";
import { objectRegistry } from "./registry";
import {
	$objectRevisions,
	executeOperation,
	objectChanged,
	objectRevisionKey,
} from "./runtime";
import { objectRef } from "./types";

describe("object runtime changes", () => {
	test("an operation can notify every view of a persisted object change", async () => {
		const ref = objectRef("probe.changed", "42");
		objectRegistry.register("sf-change-probe", {
			id: "sf-change-probe",
			label: "Change Probe",
			purpose: "Test surface change probe",
			types: [{ id: ref.type, label: "Changed probe" }],
			views: [],
			operations: [
				{
					id: "probe.changed.update",
					operator: "execute",
					target: ref.type,
					label: "Update changed probe",
					access: "public",
					invoke: ({ changed }) => {
						changed(ref, { value: 7 });
						return { value: 7 };
					},
				},
			],
		});
		const received: unknown[] = [];
		const revisionBefore =
			$objectRevisions.getState()[objectRevisionKey(ref)] ?? 0;
		const stop = objectChanged.watch((change) => received.push(change));

		await executeOperation({
			operationId: "probe.changed.update",
			references: [ref],
			source: "assistant",
		});

		stop();
		expect(received).toEqual([
			{
				ref,
				operationId: "probe.changed.update",
				payload: { value: 7 },
				source: "assistant",
			},
		]);
		expect($objectRevisions.getState()[objectRevisionKey(ref)]).toBe(
			revisionBefore + 1,
		);
	});
});
