import { expect, test } from "bun:test";
import { selectNativeApps } from "./apps";

test("starts processors selected by the active solution", () => {
	const apps = selectNativeApps(
		["fujin", "behemoth", "centimanus", "resonus"],
		["curaengine", "opencamlib"],
	);

	expect(apps.map((app) => app.name)).toEqual([
		"fujin",
		"behemoth",
		"centimanus",
		"resonus",
		"curaengine",
		"opencamlib",
	]);
});

test("does not start an unselected processor from CONVERGED_DEV_APPS", () => {
	const apps = selectNativeApps(["fujin", "curaengine"], []);
	expect(apps.map((app) => app.name)).toEqual(["fujin"]);
});

test("starts centimanus whenever the active solution has workflows", () => {
	const apps = selectNativeApps(["fujin", "behemoth", "resonus"], [], 1);
	expect(apps.map((app) => app.name)).toContain("centimanus");
});
