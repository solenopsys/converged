import { expect, test } from "bun:test";
import { formatElapsed } from "./timing";

test("formats rounded non-negative command timings", () => {
	expect(formatElapsed("cli cron list", 123.6)).toBe("[cli cron list 124ms]");
	expect(formatElapsed("cli cron list", -1)).toBe("[cli cron list 0ms]");
});
