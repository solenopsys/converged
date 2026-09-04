import { describe, expect, test } from "bun:test";
import { type LayerFile, mergeLayers } from "./layers";

const layer = (
	name: string,
	modules: Record<string, string>,
	base: string[] = [],
): LayerFile => ({ layer: name, extends: base, encoding: "br", modules });

describe("registry layers", () => {
	const converged = layer("converged", {
		"rp-struct.js": "aaa",
		"rp-auth.js": "bbb",
	});
	const club = layer("club", { "rp-companies.js": "ccc" }, ["converged"]);

	test("a product's names do not replace the base layer's", () => {
		// The regression this exists for: club published, converged's twenty
		// repositories vanished from the mapping, and every pod running the
		// merged solution failed to resolve `struct`.
		expect(mergeLayers([converged, club])).toEqual({
			"rp-struct.js": "aaa",
			"rp-auth.js": "bbb",
			"rp-companies.js": "ccc",
		});
	});

	test("the result does not depend on which build published last", () => {
		expect(mergeLayers([club, converged])).toEqual(
			mergeLayers([converged, club]),
		);
	});

	test("a product overriding a base module wins whatever the order", () => {
		const fork = layer("club", { "rp-auth.js": "own" }, ["converged"]);
		for (const order of [
			[converged, fork],
			[fork, converged],
		]) {
			expect(mergeLayers(order)["rp-auth.js"]).toBe("own");
		}
	});

	test("a base that has not published yet still leaves the product usable", () => {
		expect(mergeLayers([club])).toEqual({ "rp-companies.js": "ccc" });
	});

	test("a cycle is reported rather than folded silently", () => {
		const a = layer("a", { "rp-a.js": "1" }, ["b"]);
		const b = layer("b", { "lm-b.js": "2" }, ["a"]);
		expect(() => mergeLayers([a, b])).toThrow(/layer cycle/);
	});
});
