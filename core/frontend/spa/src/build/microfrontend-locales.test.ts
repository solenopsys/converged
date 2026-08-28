import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { importMapSpecifiers } from "./import-map";
import {
	localizedMicrofrontendEntry,
	readMicrofrontendLocales,
} from "./microfrontend-locales";

const projectRoot = resolve(import.meta.dir, "../../../../..");
const authEntry = resolve(
	projectRoot,
	"modules/microfrontends/sequrity/mf-auth/src/index.ts",
);

describe("microfrontend locale compiler", () => {
	test("reads and embeds every auth locale into its entry chunk", async () => {
		const localized = await localizedMicrofrontendEntry(authEntry, "auth");
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
		if (!output) throw new Error("Microfrontend build emitted no entry chunk");
		const script = await output.text();
		expect(script).toContain("registerMicrofrontendLocales");
		expect(script).toContain('ingestMicrofrontendLlmCatalog("mf-auth"');
		expect(script).toContain("Welcome to Converged");
		expect(script).toContain("Добро пожаловать");
	});

	test("leaves an entry without a locales directory untouched", async () => {
		const entry = resolve(projectRoot, "core/frontend/spa/src/client/main.tsx");
		expect(await readMicrofrontendLocales(entry)).toEqual({});
		const localized = await localizedMicrofrontendEntry(entry, "shell-test");
		expect(localized.entrypoint).toBe(entry);
	});
});
