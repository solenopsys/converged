import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { importMapSpecifiers } from "./import-map";
import {
	localizedSurfaceEntry,
	readSurfaceLocales,
} from "./surface-locales";

const projectRoot = resolve(import.meta.dir, "../../../../..");
const authEntry = resolve(
	projectRoot,
	"modules/surfaces/sequrity/sf-auth/src/index.ts",
);

describe("surface locale compiler", () => {
	test("reads and embeds every auth locale into its entry chunk", async () => {
		const localized = await localizedSurfaceEntry(authEntry, "auth");
		expect(Object.keys(localized.catalog)).toEqual([
			"de",
			"en",
			"es",
			"fr",
			"it",
			"pt",
			"ru",
		]);

		const result = await Bun.build({
			entrypoints: [localized.entrypoint],
			target: "browser",
			format: "esm",
			external: importMapSpecifiers,
			plugins: [localized.plugin],
			minify: true,
		});
		expect(result.success).toBe(true);
		const output = result.outputs.find((item) => item.kind === "entry-point");
		if (!output) throw new Error("Surface build emitted no entry chunk");
		const script = await output.text();
		expect(script).toContain("registerSurfaceLocales");
		expect(script).toContain("defineSurface");
		expect(script).toContain("Welcome to Converged");
		expect(script).toContain("Добро пожаловать");
	});

	test("leaves an entry without a locales directory untouched", async () => {
		const entry = resolve(projectRoot, "core/frontend/spa/src/client/main.tsx");
		expect(await readSurfaceLocales(entry)).toEqual({});
		const localized = await localizedSurfaceEntry(entry, "shell-test");
		expect(localized.entrypoint).toBe(entry);
	});
});
