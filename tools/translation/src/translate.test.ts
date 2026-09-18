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
import { hashText } from "./fs";
import { TranslationStore } from "./store";
import { emptyTally, translateProject } from "./translate";
import type { ProjectConfig, ProjectSnapshot } from "./types";

let root: string;
const originalFetch = globalThis.fetch;
const originalApiKey = process.env.OPENAI_API_KEY;
const originalModel = process.env.DOCS_TRANSLATION_MODEL;
const originalProvider = process.env.DOCS_TRANSLATION_PROVIDER;
const originalOpenrouterKey = process.env.OPENROUTER_API_KEY;

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
	if (originalProvider === undefined)
		delete process.env.DOCS_TRANSLATION_PROVIDER;
	else process.env.DOCS_TRANSLATION_PROVIDER = originalProvider;
	if (originalOpenrouterKey === undefined)
		delete process.env.OPENROUTER_API_KEY;
	else process.env.OPENROUTER_API_KEY = originalOpenrouterKey;
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
							translations: { ru: "# Руководство\n\nРусский текст.\n" } },
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

test("openrouter provider sends chat completions and reads its answer", async () => {
	process.env.DOCS_TRANSLATION_PROVIDER = "openrouter";
	process.env.OPENROUTER_API_KEY = "or-key";
	let url = "";
	let requestBody: Record<string, unknown> = {};
	let auth = "";
	globalThis.fetch = (async (input, init) => {
		url = String(input);
		auth = new Headers(init?.headers).get("Authorization") ?? "";
		requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
		return new Response(
			JSON.stringify({
				choices: [
					{
						message: {
							content: JSON.stringify({
								items: [
									{
										id: "docs:guide.md:ru",
										translations: { ru: "# Руководство\n\nРусский текст.\n" } },
								],
							}),
						},
					},
				],
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
						exists: false,
						hash: "",
						status: "missing",
						reasons: [],
					},
				},
			},
		},
		orphans: {},
		routes: [],
	};

	const store = new TranslationStore(join(root, ".index"));
	expect(await translateProject(project, snapshot, store)).toBe(1);
	expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
	expect(auth).toBe("Bearer or-key");
	expect(requestBody.model).toBe("test-translation-model");
	const messages = requestBody.messages as Array<{ role: string; content: string }>;
	expect(messages.map((message) => message.role)).toEqual(["system", "user"]);
	const userPayload = JSON.parse(messages[1]?.content ?? "{}") as { locales?: string[] };
	expect(userPayload.locales).toEqual(["ru"]);
	expect(readFileSync(join(root, "cache", "ru", "guide.md"), "utf8")).toBe(
		"# Руководство\n\nРусский текст.\n",
	);
	store.close();
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
							translations: { ru: '{"title":"Незакрытая строка}' } },
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

test("skips translated JSON with missing source fields", async () => {
	writeFileSync(
		join(root, "docs", "config.json"),
		'{"title":"English","labels":{"of":"of"}}\n',
	);
	mkdirSync(join(root, "cache", "ru"), { recursive: true });
	const target = join(root, "cache", "ru", "config.json");
	writeFileSync(target, '{"title":"Previous","labels":{"of":"of"}}\n');
	globalThis.fetch = (async (_input, _init) =>
		new Response(
			JSON.stringify({
				output_text: JSON.stringify({
					items: [
						{ id: "docs:config.json:ru", translations: { ru: '{"title":"Перевод"}' } },
					],
				}),
			}),
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
						reasons: [],
					},
				},
			},
		},
		orphans: { ru: [] },
		routes: [],
	};

	expect(
		await translateProject(
			project,
			snapshot,
			new TranslationStore(join(root, ".translation")),
		),
	).toBe(0);
	expect(readFileSync(target, "utf8")).toBe(
		'{"title":"Previous","labels":{"of":"of"}}\n',
	);
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

test("skips a linked identical target, requeues an unlinked copy", async () => {
	const sourceText = "# Guide\n\nEnglish text for the workshop manual.\n";
	const sourceHash = hashText(sourceText);
	writeFileSync(join(root, "docs", "guide.md"), sourceText);
	mkdirSync(join(root, "cache", "ru"), { recursive: true });
	const target = join(root, "cache", "ru", "guide.md");
	const store = new TranslationStore(join(root, ".translation"));
	let calls = 0;
	globalThis.fetch = (async (_input, _init) => {
		calls += 1;
		return new Response(
			JSON.stringify({
				output_text: JSON.stringify({
					items: [
						{
							id: "docs:guide.md:ru",
							translations: { ru: "# Руководство\n\nРусский текст.\n" } },
					],
				}),
			}),
			{ status: 200, headers: { "Content-Type": "application/json" } },
		);
	}) as typeof fetch;

	const snapshotFor = (linked: boolean): ProjectSnapshot => {
		writeFileSync(target, sourceText);
		let targetHash = sourceHash;
		if (linked) {
			targetHash = store.save(sourceHash, "ru", sourceText, target);
		}
		return {
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
	};

	// Linked copy: intentional fallback, no API calls.
	expect(await translateProject(project, snapshotFor(true), store)).toBe(0);
	expect(calls).toBe(0);

	// Unlinked copy: a seed the build left behind, gets translated.
	const store2 = new TranslationStore(join(root, ".translation2"));
	expect(await translateProject(project, snapshotFor(false), store2)).toBe(1);
	expect(calls).toBe(1);
	expect(readFileSync(target, "utf8")).toBe(
		"# Руководство\n\nРусский текст.\n",
	);
});

test("large JSON goes string-by-string and keeps structure", async () => {
	const big = {
		title: "English title",
		id: "scene-1",
		coords: Array.from({ length: 5000 }, (_, i) => i),
		nested: { subtitle: "English subtitle", tone: "accent" },
	};
	writeFileSync(join(root, "docs", "big.json"), JSON.stringify(big));
	mkdirSync(join(root, "cache", "ru"), { recursive: true });
	const seen: string[] = [];
	globalThis.fetch = (async (_input, init) => {
		const body = JSON.parse(String(init?.body)) as {
			input: string;
		};
		const items = (JSON.parse(body.input) as { items: Array<{
			id: string;
			content: string;
		}> }).items;
		seen.push(...items.map((item) => item.content));
		return new Response(
			JSON.stringify({
				output_text: JSON.stringify({
					items: items.map((item) => ({
						id: item.id,
						translations: { ru: `RU:${item.content}` },
					})),
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
			"big.json": {
				fileType: "json",
				sourceHash: "c".repeat(64),
				targets: {
					ru: {
						exists: false,
						hash: "",
						status: "missing",
						reasons: ["missing"],
					},
				},
			},
		},
		orphans: { ru: [] },
		routes: [],
	};

	const store = new TranslationStore(join(root, ".translation"));
	expect(await translateProject(project, snapshot, store)).toBe(1);
	// Only human strings travel; numbers and ids stay local.
	expect(seen.sort()).toEqual(["English subtitle", "English title"]);
	const target = JSON.parse(
		readFileSync(join(root, "cache", "ru", "big.json"), "utf8"),
	);
	expect(target.title).toBe("RU:English title");
	expect(target.nested.subtitle).toBe("RU:English subtitle");
	expect(target.id).toBe("scene-1");
	expect(target.nested.tone).toBe("accent");
	expect(target.coords).toHaveLength(5000);
});

/**
 * One file (all locales) is one request and one pool task: files fly
 * concurrently, each returning every locale in a single answer.
 */
test("each file translates all locales in one request, files in parallel", async () => {
	const locales = ["ru", "de", "es", "fr", "it", "pt"];
	for (let i = 0; i < 12; i += 1) {
		writeFileSync(join(root, "docs", `doc-${i}.md`), `# Doc ${i}\n`);
	}

	let live = 0;
	let peak = 0;
	let requests = 0;
	globalThis.fetch = (async (_input, init) => {
		live += 1;
		peak = Math.max(peak, live);
		requests += 1;
		const body = JSON.parse(String(init?.body)) as { input: string };
		const parsed = JSON.parse(body.input) as {
			locales: string[];
			items: Array<{ id: string; content: string }>;
		};
		const { items, locales: want } = parsed;
		await Bun.sleep(5);
		live -= 1;
		return new Response(
			JSON.stringify({
				output_text: JSON.stringify({
					items: items.map((item) => ({
						id: item.id,
						translations: Object.fromEntries(
							want.map((locale) => [locale, `${item.content}translated-${locale}\n`]),
						),
					})),
				}),
			}),
			{ status: 200, headers: { "Content-Type": "application/json" } },
		);
	}) as typeof fetch;

	const files: ProjectSnapshot["files"] = {};
	for (let i = 0; i < 12; i += 1) {
		files[`doc-${i}.md`] = {
			fileType: "markdown",
			sourceHash: i.toString(16).padStart(64, "0"),
			targets: Object.fromEntries(
				locales.map((locale) => [
					locale,
					{ exists: false, hash: "", status: "missing" as const, reasons: [] },
				]),
			),
		};
	}
	const snapshot: ProjectSnapshot = {
		root: join(root, "docs"),
		targetRoot: join(root, "cache"),
		sourceLocale: "en",
		targetLocales: locales,
		files,
		orphans: {},
		routes: [],
	};

	const store = new TranslationStore(join(root, ".index"));
	const tally = emptyTally();
	const translated = await translateProject(
		{ ...project, targetLocales: locales },
		snapshot,
		store,
		{ concurrency: 3, tally },
	);

	expect(translated).toBe(72);
	// 12 files, one multi-locale request each; the pool runs files
	// concurrently.
	expect(requests).toBe(12);
	expect(peak).toBe(3);
	expect(peak).toBeLessThanOrEqual(3);
	expect(tally.requests).toBe(12);
	expect(tally.translated).toBe(72);
	expect(readFileSync(join(root, "cache", "pt", "doc-0.md"), "utf8")).toBe(
		"# Doc 0\ntranslated-pt\n",
	);
	store.close();
});

test("a rate limit is waited out rather than failing the run", async () => {
	let attempts = 0;
	globalThis.fetch = (async (_input, init) => {
		attempts += 1;
		if (attempts === 1) {
			return new Response(JSON.stringify({ error: { message: "slow down" } }), {
				status: 429,
				headers: { "Content-Type": "application/json" },
			});
		}
		const body = JSON.parse(String(init?.body)) as { input: string };
		const { items } = JSON.parse(body.input) as {
			items: Array<{ id: string }>;
		};
		return new Response(
			JSON.stringify({
				output_text: JSON.stringify({
					items: items.map((item) => ({ id: item.id, translations: { [item.id.split(":").pop() as string]: "ok\n" } })),
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
					ru: { exists: false, hash: "", status: "missing", reasons: [] },
				},
			},
		},
		orphans: {},
		routes: [],
	};

	const store = new TranslationStore(join(root, ".index"));
	const tally = emptyTally();
	expect(
		await translateProject(project, snapshot, store, { concurrency: 1, tally }),
	).toBe(1);
	expect(attempts).toBe(2);
	expect(tally.retries).toBe(1);
	store.close();
});
