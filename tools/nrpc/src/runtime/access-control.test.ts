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
			mode: "rwx",
		});
		expect(parsePermission("files/list(wr)")?.mode).toBe("rw");
		expect(parsePermission("files list(r)")).toBeNull();
		expect(parsePermission("files/list(rz)")).toBeNull();
	});

	test("a third segment names the kind the permission is about", () => {
		expect(parsePermission("rp/files/save(w)")).toEqual({
			kind: "rp",
			service: "files",
			method: "save",
			mode: "w",
		});
		expect(parsePermission("wf/file-processing/*(x)")?.mode).toBe("x");
	});

	test("execute is its own capability, not a step above write", () => {
		const matcher = new AccessMatcher(["wf/report/*(x)", "rp/files/save(w)"]);
		expect(matcher.canKind("wf", "report", "run", "x")).toBe(true);
		expect(matcher.canKind("wf", "report", "run", "w")).toBe(false);
		expect(matcher.canKind("rp", "files", "save", "x")).toBe(false);
	});

	test("a kinded grant does not leak across kinds", () => {
		const matcher = new AccessMatcher(["wf/report/*(x)"]);
		expect(matcher.canKind("wf", "report", "run", "x")).toBe(true);
		expect(matcher.canKind("rp", "report", "run", "x")).toBe(false);
		expect(matcher.canKind("wf", "other", "run", "x")).toBe(false);
	});

	test("a kindless grant still answers a kinded question", () => {
		// Every preset written before kinds existed looks like this.
		const matcher = new AccessMatcher(["files/save(w)"]);
		expect(matcher.canKind("rp", "files", "save", "w")).toBe(true);
		expect(matcher.can("files", "save", "w")).toBe(true);
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
