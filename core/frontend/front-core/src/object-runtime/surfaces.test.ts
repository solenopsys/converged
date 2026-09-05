import { beforeAll, describe, expect, test } from "bun:test";
import { setOperationAuthorizationController } from "./authorization";
import { objectRegistry } from "./registry";
import { availableSurfaces, surfaceConfigured } from "./surfaces";
import { Category } from "./types";

// The scenario this file exists for: a guest opens the app and asks to see the
// companies. Nothing about that request is public — the type needs an account —
// and it still has to work, because signing in is what happens *when the guest
// tries*, not a gate on being told the section exists.

beforeAll(() => {
	objectRegistry.declare("sf-companies", {
		id: "sf-companies",
		label: "Companies",
		purpose: "Company records, their contacts and details",
		types: [
			{
				id: "companies.company",
				label: "Company",
				pluralLabel: "Companies",
				categories: [Category.Business, Category.Selectable],
				selection: { filters: [] },
			},
		],
		views: [
			{
				id: "companies.company.table",
				accepts: { kind: "set", type: "companies.company" },
			},
		],
		operations: [],
	});
	objectRegistry.declare("sf-empty", {
		id: "sf-empty",
		label: "Empty",
		purpose: "Owns nothing the resolver can reach",
		types: [],
		views: [],
		operations: [],
	});
});

describe("what the interface offers", () => {
	test("a guest is offered a section whose objects require an account", () => {
		// No controller at all is the hardest case: `canExecuteOperation` says no
		// to everything non-public, which is exactly what a signed-out browser
		// looks like before the auth gateway has answered.
		setOperationAuthorizationController(null);
		surfaceConfigured({ surfaces: [{ id: "sf-companies" }] });

		expect(availableSurfaces().map(({ id }) => id)).toEqual(["sf-companies"]);
	});

	test("its purpose travels with it, so one pass can tell it from its neighbours", () => {
		surfaceConfigured({ surfaces: [{ id: "sf-companies" }] });

		expect(availableSurfaces()[0]?.purpose).toBe(
			"Company records, their contacts and details",
		);
	});

	test("a surface the resolver cannot reach is not offered", () => {
		surfaceConfigured({
			surfaces: [{ id: "sf-companies" }, { id: "sf-empty" }],
		});

		expect(availableSurfaces().map(({ id }) => id)).toEqual(["sf-companies"]);
	});

	test("`enabled: true` overrides that, for a surface that is reachable by other means", () => {
		surfaceConfigured({
			surfaces: [{ id: "sf-empty", enabled: true }],
		});

		expect(availableSurfaces().map(({ id }) => id)).toEqual(["sf-empty"]);
	});
});

describe("a manifest from an older build", () => {
	test("a surface with no label or purpose is listed, not a crash", () => {
		// The index is a build artefact. One built before these fields existed
		// carries neither, and sorting the list on an undefined label used to
		// throw inside the step that reads it — taking down every turn, not just
		// the listing.
		objectRegistry.declare("sf-legacyindex", {
			id: "sf-legacyindex",
			types: [
				{
					id: "legacy.thing",
					label: "Thing",
					pluralLabel: "Things",
					categories: [Category.Selectable],
					selection: { filters: [] },
				},
			],
			views: [
				{
					id: "legacy.thing.table",
					accepts: { kind: "set", type: "legacy.thing" },
				},
			],
			operations: [],
		} as never);
		surfaceConfigured({
			surfaces: [{ id: "sf-companies" }, { id: "sf-legacyindex" }],
		});

		const listed = availableSurfaces();
		expect(listed.map(({ id }) => id)).toContain("sf-legacyindex");
		expect(listed.find(({ id }) => id === "sf-legacyindex")?.label).toBe(
			"sf-legacyindex",
		);
	});
});
