import { describe, expect, test } from "bun:test";
import {
	$slashSections,
	registerSlashSection,
	runSlashCommand,
} from "./registry";

describe("slash command registry", () => {
	test("suggests the closest section for a short typo", async () => {
		registerSlashSection({
			name: "functions",
			description: "Function catalog",
		});
		expect($slashSections.getState()).toEqual([
			expect.objectContaining({ name: "functions" }),
		]);

		await expect(runSlashCommand("/functiions")).resolves.toContain(
			"Did you mean `/functions`?",
		);
	});
});
