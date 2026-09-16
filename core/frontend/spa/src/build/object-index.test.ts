import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	commandLocalizationProblems,
	manifestLocales,
	readLlmCatalog,
} from "./object-index";

const roots: string[] = [];

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true });
});

describe("object index LLM metadata", () => {
	test("reads the surface llm.json alongside its object manifest", async () => {
		const root = mkdtempSync(join(tmpdir(), "object-index-llm-"));
		roots.push(root);
		writeFileSync(
			join(root, "llm.json"),
			JSON.stringify({
				actions: {
					"leads.show": {
						brief: "Show leads",
						description: "Show leads selected for a campaign",
						category: "sales",
						exposure: "user",
						priority: "primary",
					},
				},
			}),
		);

		const catalog = await readLlmCatalog(root, "sales");

		expect(catalog.actions["leads.show"]?.description).toBe(
			"Show leads selected for a campaign",
		);
	});

	test("rejects a catalog without actions", async () => {
		const root = mkdtempSync(join(tmpdir(), "object-index-llm-"));
		roots.push(root);
		writeFileSync(join(root, "llm.json"), "{}");

		await expect(readLlmCatalog(root, "sales")).rejects.toThrow(
			"llm.json must contain an actions object",
		);
	});
});

describe("translations carried by the index", () => {
	test("only the keys the manifest names, per locale, nested as in the catalog", () => {
		const manifest = {
			id: "sf-files",
			label: "Files",
			labelKey: "surface.label",
			purpose: "Uploaded files",
			purposeKey: "surface.purpose",
			types: [
				{ id: "files.file", label: "File", pluralLabelKey: "menu.files" },
			],
			views: [],
			operations: [
				{
					id: "files.upload",
					operator: "execute" as const,
					label: "Upload",
					labelKey: "operations.upload.label",
				},
			],
		};
		const locales = manifestLocales(manifest, {
			ru: {
				surface: { label: "Файлы", purpose: "Загруженные файлы" },
				menu: { files: "Файлы", collections: "Коллекции" },
				operations: { upload: { label: "Загрузить" } },
				columns: { name: "Название" },
			},
			de: { unrelated: "x" },
		});

		expect(locales).toEqual({
			ru: {
				surface: { label: "Файлы", purpose: "Загруженные файлы" },
				menu: { files: "Файлы" },
				operations: { upload: { label: "Загрузить" } },
			},
		});
	});
});

describe("commands are localized", () => {
	const manifest = (operation: Record<string, unknown>) => ({
		id: "sf-demo",
		label: "Demo",
		purpose: "Demo",
		types: [],
		views: [],
		operations: [
			{
				id: "demo.run",
				operator: "execute" as const,
				label: "Run",
				...operation,
			},
		],
	});

	test("a command without keys is refused", () => {
		expect(
			commandLocalizationProblems("demo", manifest({}), { en: {} }),
		).toEqual([
			"sf-demo: demo.run has no labelKey",
			"sf-demo: demo.run has no descriptionKey",
		]);
	});

	test("every locale has to translate both keys", () => {
		const keys = {
			labelKey: "operations.run.label",
			descriptionKey: "operations.run.description",
		};
		expect(
			commandLocalizationProblems("demo", manifest(keys), {
				en: { operations: { run: { label: "Run", description: "Run it" } } },
				ru: { operations: { run: { label: "Запустить" } } },
			}),
		).toEqual([
			'sf-demo: ru.json has no "operations.run.description" (demo.run)',
		]);
	});
});
