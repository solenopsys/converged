import { describe, expect, test } from "bun:test";
import { type LayerFile, mergeLayers } from "./layers";

const layer = (
	name: string,
	modules: Record<string, string>,
	base: string[] = [],
): LayerFile => ({ layer: name, extends: base, encoding: "br", modules });

describe("registry layers", () => {
	const converged = layer("converged", {
		"ms-struct.js": "aaa",
		"ms-auth.js": "bbb",
	});
	const club = layer("club", { "ms-companies.js": "ccc" }, ["converged"]);

	test("a product's names do not replace the base layer's", () => {
		// The regression this exists for: club published, converged's twenty
		// microservices vanished from the mapping, and every pod running the
		// merged solution failed to resolve `struct`.
		expect(mergeLayers([converged, club])).toEqual({
			"ms-struct.js": "aaa",
			"ms-auth.js": "bbb",
			"ms-companies.js": "ccc",
		});
	});

	test("the result does not depend on which build published last", () => {
		expect(mergeLayers([club, converged])).toEqual(
			mergeLayers([converged, club]),
		);
	});

	test("a product overriding a base module wins whatever the order", () => {
		const fork = layer("club", { "ms-auth.js": "own" }, ["converged"]);
		for (const order of [
			[converged, fork],
			[fork, converged],
		]) {
			expect(mergeLayers(order)["ms-auth.js"]).toBe("own");
		}
	});

	test("a base that has not published yet still leaves the product usable", () => {
		expect(mergeLayers([club])).toEqual({ "ms-companies.js": "ccc" });
	});

	test("a cycle is reported rather than folded silently", () => {
		const a = layer("a", { "ms-a.js": "1" }, ["b"]);
		const b = layer("b", { "ms-b.js": "2" }, ["a"]);
		expect(() => mergeLayers([a, b])).toThrow(/layer cycle/);
	});
});
