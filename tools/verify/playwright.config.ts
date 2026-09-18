/**
 * The runner side of `verify run`. Not meant to be started by hand: the plan it
 * reads (which specs, which browsers, where evidence goes) is written by the CLI.
 */
import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { readPlan } from "./src/plan";

const plan = readPlan();

const DEVICES = {
	chromium: devices["Desktop Chrome"],
	firefox: devices["Desktop Firefox"],
	webkit: devices["Desktop Safari"],
};

function literal(path: string): string {
	return path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default defineConfig({
	// Specs live in several checkouts; the workspace root holds all of them and
	// testMatch narrows it to exactly the planned files.
	testDir: resolve(import.meta.dirname, "../../.."),
	testMatch: plan.specs.map((spec) => new RegExp(`^${literal(spec)}$`)),
	outputDir: resolve(plan.outputDir, "artifacts"),
	retries: plan.retries,
	forbidOnly: true,
	timeout: 120_000,
	expect: { timeout: 15_000 },
	reporter: [
		["list"],
		[
			"html",
			{ outputFolder: resolve(plan.outputDir, "report"), open: "never" },
		],
		[resolve(import.meta.dirname, "src/reporter.ts")],
	],
	use: {
		baseURL: plan.baseURL,
		// Every story leaves evidence, passed or not: a PASS nobody can look at
		// is a claim, not a verification.
		screenshot: "on",
		trace: "on",
		locale: "en-US",
		timezoneId: "UTC",
	},
	projects: plan.browsers.map((name) => ({
		name,
		use: { ...DEVICES[name] },
	})),
});
