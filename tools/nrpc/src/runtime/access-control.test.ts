import { describe, expect, test } from "bun:test";
import {
	AccessMatcher,
	parsePermission,
	resolveAccessForMethod,
} from "./access-control";

describe("AccessMatcher", () => {
	test("normalizes mode and names exactly once", () => {
		expect(parsePermission(" Files / List ")).toEqual({
			service: "Files",
			method: "List",
			mode: "rw",
		});
		expect(parsePermission("files/list(wr)")?.mode).toBe("rw");
		expect(parsePermission("files list(r)")).toBeNull();
		expect(parsePermission("files/list(rx)")).toBeNull();
	});

	test("requires every requested capability and supports both wildcards", () => {
		const matcher = new AccessMatcher([
			"Files/List(r)",
			"all/audit(w)",
			"logs/*(r)",
		]);
		expect(matcher.can("files", "list", "r")).toBe(true);
		expect(matcher.can("files", "list", "w")).toBe(false);
		expect(matcher.can("any-service", "AUDIT", "w")).toBe(true);
		expect(matcher.can("LOGS", "tail", "r")).toBe(true);
		expect(matcher.can("logs", "tail", "rw")).toBe(false);
	});

	test("matches the generated method default", () => {
		expect(resolveAccessForMethod("getState")).toBe("r");
		expect(resolveAccessForMethod("DESCRIBE")).toBe("r");
		expect(resolveAccessForMethod("reload")).toBe("w");
	});
});
