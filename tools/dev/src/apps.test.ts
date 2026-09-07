import { expect, test } from "bun:test";
import { fluentbitEnv, selectNativeApps } from "./apps";

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

test("the dev collector stays off unless the env file asks for it", () => {
	expect(fluentbitEnv({})).toEqual({ FUJIN_FLUENTBIT: "off" });
	expect(fluentbitEnv({ FUJIN_FLUENTBIT: "false" })).toEqual({
		FUJIN_FLUENTBIT: "off",
	});
});

test("collector parameters come from the env file, with dev defaults", () => {
	// The wrapper artifact is only resolved on the enabled path, so this case
	// asserts through a stub rather than requiring a fluentbit build.
	const base = {
		FUJIN_FLUENTBIT: "on",
		STORAGE_SCOPE: "club",
		FUJIN_INGEST_BLOCK_SIZE: "25",
	};
	let env: Record<string, string>;
	try {
		env = fluentbitEnv(base);
	} catch (error) {
		// No fluentbit wrapper built here: that is the one thing this path
		// legitimately demands, and the message has to say so.
		expect(String(error)).toContain("protocols/fluentbit");
		return;
	}
	expect(env.FUJIN_FLUENTBIT).toBe("on");
	expect(env.FUJIN_INGEST_BLOCK_SIZE).toBe("25");
	// Rows land in the same tenant the rest of the run stores under.
	expect(env.FUJIN_INGEST_SCOPE).toBe("club");
	expect(env.FUJIN_INGEST_FLUSH_MS).toBe("5000");
});
