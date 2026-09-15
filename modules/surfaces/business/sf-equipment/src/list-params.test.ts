import { describe, expect, test } from "bun:test";
import { flatListParams } from "./list-params";

describe("table state as rp-equipment's parameters", () => {
	const fields = ["status", "kind", "deviceId"];

	test("a typed filter becomes the flat field the repository reads", () => {
		expect(
			flatListParams(
				{ offset: 0, limit: 50, filter: { status: { eq: "error" } } },
				fields,
			),
		).toEqual({ offset: 0, limit: 50, status: "error" });
	});

	test("a tab's defaults filter, which is what 'Needs attention' is", () => {
		expect(
			flatListParams(
				{
					offset: 0,
					limit: 50,
					presets: [{ id: "equipment.attention", params: { status: "error" } }],
				},
				fields,
			),
		).toEqual({ offset: 0, limit: 50, status: "error" });
	});

	test("a telemetry row's device key survives the AND a base selection adds", () => {
		expect(
			flatListParams(
				{
					offset: 0,
					limit: 50,
					filter: {
						AND: [
							{ deviceId: { eq: "printer-1" } },
							{ kind: { contains: "fdm" } },
						],
					},
				},
				fields,
			),
		).toEqual({ offset: 0, limit: 50, deviceId: "printer-1", kind: "fdm" });
	});

	test("fields the repository cannot filter by are dropped, not sent", () => {
		expect(
			flatListParams(
				{
					offset: 0,
					limit: 50,
					filter: {
						location: { eq: "hall" },
						status: { in: ["idle", "error"] },
					},
				},
				fields,
			),
		).toEqual({ offset: 0, limit: 50 });
	});
});
