import { describe, expect, test } from "bun:test";
import { objectRegistry, surfaceConfigured } from "front-core/object-runtime";
import { allSurfaceNav, groupSurfaceNav } from "./surface-nav";
import type { SurfaceTab, WorkspaceSubtab } from "./workspace";

const View = (() => null) as WorkspaceSubtab["view"];

function declare(id: string, label: string, purpose: string): void {
	objectRegistry.declare(id, {
		id,
		label,
		purpose,
		types: [],
		views: [],
		operations: [
			{
				id: `${id}.probe`,
				operator: "execute",
				label: `${label} probe`,
				access: "public",
			},
		],
	});
}

declare(
	"sf-companies",
	"Companies",
	"Company records, their contacts and details",
);
declare("sf-mailing", "Mail", "Incoming and outgoing mail");

function subtab(key: string, surface: string): WorkspaceSubtab {
	return { key, surface, title: key, view: View, props: {}, permanent: false };
}

function tab(id: string, label: string, pressed: string | null): SurfaceTab {
	return {
		id,
		label,
		purpose: `${label} purpose`,
		active: pressed !== null,
		pinned: false,
		pressed,
	};
}

describe("surface navigation", () => {
	test("each surface carries its own buttons", () => {
		const groups = groupSurfaceNav(
			[tab("sf-companies", "Companies", null), tab("sf-mailing", "Mail", "in")],
			[
				subtab("companies", "sf-companies"),
				subtab("in", "sf-mailing"),
				subtab("out", "sf-mailing"),
			],
		);

		expect(groups.map(({ label }) => label)).toEqual(["Companies", "Mail"]);
		expect(groups[1]?.subtabs.map(({ key }) => key)).toEqual(["in", "out"]);
		expect(groups[1]?.pressed).toBe("in");
	});

	test("show-all adds the permitted surfaces that are not open yet", () => {
		surfaceConfigured({
			surfaces: [{ id: "sf-companies" }, { id: "sf-mailing" }],
		});

		const groups = allSurfaceNav(
			[tab("sf-mailing", "Mail", "in")],
			[subtab("in", "sf-mailing")],
		);

		// Open first, then the rest. Companies is reachable but was never opened,
		// so it only appears behind "show all" — the default list is what is
		// actually in front of the user.
		expect(groups.map(({ surface }) => surface)).toEqual([
			"sf-mailing",
			"sf-companies",
		]);
		expect(groups[1]?.subtabs).toEqual([]);
		expect(groups[1]?.purpose).toBe(
			"Company records, their contacts and details",
		);
	});
});

describe("the default menu is not a catalog", () => {
	test("with nothing open the default list is empty, not every registered surface", () => {
		surfaceConfigured({
			surfaces: [{ id: "sf-companies" }, { id: "sf-mailing" }],
		});

		// Two surfaces are permitted and neither is open. The menu shows nothing:
		// a wall of sections the user has not asked for is the scattering this
		// structure exists to end.
		expect(groupSurfaceNav([], [])).toEqual([]);
		expect(allSurfaceNav([], []).map(({ surface }) => surface)).toEqual([
			"sf-companies",
			"sf-mailing",
		]);
	});
});
