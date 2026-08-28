import { afterEach, beforeEach, expect, test } from "bun:test";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TranslationStore } from "./store";
import { translateProject } from "./translate";
import type { ProjectConfig, ProjectSnapshot } from "./types";

let root: string;
const originalFetch = globalThis.fetch;
const originalApiKey = process.env.OPENAI_API_KEY;
const originalModel = process.env.DOCS_TRANSLATION_MODEL;

const project: ProjectConfig = {
	name: "docs",
	root: ".",
	sourcePath: ".",
	targetRoot: "./cache",
	sourceLocale: "en",
	targetLocales: ["ru"],
};

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "translate-"));
	mkdirSync(join(root, "docs"), { recursive: true });
	writeFileSync(join(root, "docs", "guide.md"), "# Guide\n\nEnglish text.\n");
	process.env.OPENAI_API_KEY = "test-key";
	process.env.DOCS_TRANSLATION_MODEL = "test-translation-model";
});

afterEach(() => {
	globalThis.fetch = originalFetch;
	if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
	else process.env.OPENAI_API_KEY = originalApiKey;
	if (originalModel === undefined) delete process.env.DOCS_TRANSLATION_MODEL;
	else process.env.DOCS_TRANSLATION_MODEL = originalModel;
	rmSync(root, { recursive: true, force: true });
});

test("translates actionable files and writes the locale target", async () => {
	let requestBody: Record<string, unknown> = {};
	globalThis.fetch = (async (_input, init) => {
		requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
		return new Response(
			JSON.stringify({
				output_text: JSON.stringify({
					items: [
						{
							id: "docs:guide.md:ru",
							translation: "# Руководство\n\nРусский текст.\n",
						},
					],
				}),
			}),
			{ status: 200, headers: { "Content-Type": "application/json" } },
		);
	}) as typeof fetch;

	const snapshot: ProjectSnapshot = {
		root: join(root, "docs"),
		targetRoot: join(root, "cache"),
		sourceLocale: "en",
		targetLocales: ["ru"],
		files: {
			"guide.md": {
				fileType: "markdown",
				sourceHash: "a".repeat(64),
				targets: {
					ru: {
						exists: true,
						hash: "target",
						status: "untranslated-text",
						reasons: ["unchanged strings"],
					},
				},
			},
		},
		orphans: { ru: [] },
		routes: [],
	};

	const store = new TranslationStore(join(root, ".translation", "index"));
	expect(await translateProject(project, snapshot, store)).toBe(1);
	expect(readFileSync(join(root, "cache", "ru", "guide.md"), "utf8")).toBe(
		"# Руководство\n\nРусский текст.\n",
	);
	expect(requestBody.model).toBe("test-translation-model");
	expect(store.read("a".repeat(64))?.translations.ru).toHaveLength(1);
});

test("skips invalid translated JSON without overwriting the target", async () => {
	writeFileSync(join(root, "docs", "config.json"), '{"title":"English"}\n');
	mkdirSync(join(root, "cache", "ru"), { recursive: true });
	const target = join(root, "cache", "ru", "config.json");
	writeFileSync(target, '{"title":"Previous"}\n');
	globalThis.fetch = (async (_input, _init) =>
		new Response(
			JSON.stringify({
				output_text: JSON.stringify({
					items: [
						{
							id: "docs:config.json:ru",
							translation: '{"title":"Незакрытая строка}',
						},
					],
				}),
			}),
			{ status: 200, headers: { "Content-Type": "application/json" } },
		)) as typeof fetch;

	const snapshot: ProjectSnapshot = {
		root: join(root, "docs"),
		targetRoot: join(root, "cache"),
		sourceLocale: "en",
		targetLocales: ["ru"],
		files: {
			"config.json": {
				fileType: "json",
				sourceHash: "a".repeat(64),
				targets: {
					ru: {
						exists: true,
						hash: "target",
						status: "untranslated-text",
						reasons: ["unchanged strings"],
					},
				},
			},
		},
		orphans: { ru: [] },
		routes: [],
	};

	const store = new TranslationStore(join(root, ".translation", "index"));
	expect(await translateProject(project, snapshot, store)).toBe(0);
	expect(readFileSync(target, "utf8")).toBe('{"title":"Previous"}\n');
});

test("skips an existing target with the linked target hash", async () => {
	const sourceHash = "a".repeat(64);
	const target = join(root, "cache", "ru", "guide.md");
	const store = new TranslationStore(join(root, ".translation"));
	const targetHash = store.save(
		sourceHash,
		"ru",
		"# Existing translation\n",
		target,
	);
	let calls = 0;
	globalThis.fetch = (async (_input, _init) => {
		calls += 1;
		return new Response("{}", { status: 500 });
	}) as typeof fetch;

	const snapshot: ProjectSnapshot = {
		root: join(root, "docs"),
		targetRoot: join(root, "cache"),
		sourceLocale: "en",
		targetLocales: ["ru"],
		files: {
			"guide.md": {
				fileType: "markdown",
				sourceHash,
				targets: {
					ru: {
						exists: true,
						hash: targetHash,
						status: "ok",
						reasons: [],
					},
				},
			},
		},
		orphans: { ru: [] },
		routes: [],
	};

	expect(await translateProject(project, snapshot, store)).toBe(0);
	expect(calls).toBe(0);
});

test("skips an existing target identical to the English source", async () => {
	const sourceHash = "b".repeat(64);
	const store = new TranslationStore(join(root, ".translation"));
	let calls = 0;
	globalThis.fetch = (async (_input, _init) => {
		calls += 1;
		return new Response("{}", { status: 500 });
	}) as typeof fetch;

	const snapshot: ProjectSnapshot = {
		root: join(root, "docs"),
		targetRoot: join(root, "cache"),
		sourceLocale: "en",
		targetLocales: ["ru"],
		files: {
			"guide.md": {
				fileType: "markdown",
				sourceHash,
				targets: {
					ru: {
						exists: true,
						hash: sourceHash,
						status: "ok",
						reasons: [],
					},
				},
			},
		},
		orphans: { ru: [] },
		routes: [],
	};

	expect(await translateProject(project, snapshot, store)).toBe(0);
	expect(calls).toBe(0);
});
