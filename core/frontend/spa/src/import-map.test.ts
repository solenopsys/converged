import { expect, test } from "bun:test";
import { createImportMap } from "./import-map";

test("maps the object runtime subpath for browser microfrontends", () => {
	expect(createImportMap([]).imports["front-core/object-runtime"]).toBe(
		"/vendor/front-core-object-runtime.js",
	);
});
