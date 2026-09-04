import { afterEach, describe, expect, test } from "bun:test";
import { attachToFocus, focusCleared, focusedRef, focusedRefs } from "./focus";
import { objectRef } from "./types";

afterEach(() => focusCleared());

describe("object focus", () => {
	test("selects only the most recent reference for a contextual invocation", () => {
		const first = objectRef("audit.audit", "first");
		const second = objectRef("audit.audit", "second");
		attachToFocus(first);
		attachToFocus(second);

		expect(focusedRef("audit.audit")).toEqual(second);
		expect(focusedRefs(["audit.audit"])).toEqual([second, first]);
	});

	test("reopening an object makes it the current reference without duplicating it", () => {
		const first = objectRef("audit.audit", "first");
		const second = objectRef("audit.audit", "second");
		attachToFocus(first);
		attachToFocus(second);
		attachToFocus(first);

		expect(focusedRef("audit.audit")).toEqual(first);
		expect(focusedRefs(["audit.audit"])).toEqual([first, second]);
	});
});
