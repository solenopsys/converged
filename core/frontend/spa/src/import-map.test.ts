import { expect, test } from "bun:test";
import { createImportMap } from "./import-map";

test("maps the object runtime subpath for browser surfaces", () => {
	expect(createImportMap([]).imports["front-core/object-runtime"]).toBe(
		"/vendor/front-core-object-runtime.js",
	);
});

test("maps React-compatible package names to the shared Preact runtime", () => {
	const imports = createImportMap([]).imports;
	expect(imports.react).toBe("/vendor/preact-compat.js");
	expect(imports["react-dom"]).toBe("/vendor/preact-compat.js");
	expect(imports["preact/compat/client"]).toBe(
		"/vendor/preact-compat-client.js",
	);
	expect(imports["react-dom/client"]).toBe(
		"/vendor/preact-compat-client.js",
	);
});
