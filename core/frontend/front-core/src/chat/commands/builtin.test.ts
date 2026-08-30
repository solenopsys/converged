import { describe, expect, test } from "bun:test";
import { OPERATORS } from "front-core/object-runtime";
import { registerBuiltinSlashCommands } from "./builtin";
import { slashSections } from "./registry";

describe("object slash commands", () => {
	test("registers the fixed object vocabulary without legacy diagnostics", () => {
		registerBuiltinSlashCommands();
		const names = slashSections().map((section) => section.name);
		expect(
			names.filter((name) =>
				OPERATORS.includes(name as (typeof OPERATORS)[number]),
			),
		).toEqual([...OPERATORS].sort());
		expect(names).not.toContain("operators");
		expect(names).not.toContain("tools");
		expect(names).not.toContain("context");
	});
});
