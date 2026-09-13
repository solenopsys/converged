/**
 * The volume table has one job: promise exactly what the run will do.
 *
 * So the tests below check it against the same queue the translator consumes,
 * not against a recomputed estimate.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { buildQueue, JSON_STRING_LEVEL_THRESHOLD, routeFor } from "./queue";
import { scanProject } from "./scan";
import {
	beginRun,
	finishRun,
	recentRuns,
	recordItem,
	renderRuns,
	renderVolume,
	volume,
} from "./stats";
import { TranslationStore } from "./store";
import type { ControlState, ProjectConfig } from "./types";

let root: string;
let configPath: string;
let store: TranslationStore;
let state: ControlState;

const project: ProjectConfig = {
	name: "docs",
	root: "./root",
	sourcePath: "en",
	targetRoot: "./cache",
	sourceLocale: "en",
	targetLocales: ["ru", "de"],
};

function write(rel: string, content: string): void {
	const path = join(root, "root", rel);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content, "utf8");
}

function scan() {
	return scanProject(project, configPath, state, store);
}

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "translation-stats-"));
	configPath = join(root, "control.json");
	writeFileSync(configPath, "{}", "utf8");
	store = new TranslationStore(join(root, ".index"));
	state = { version: 1, updatedAt: "", projects: {} };
});

afterEach(() => {
	store.close();
	rmSync(root, { recursive: true, force: true });
});

describe("volume", () => {
	test("counts every untranslated target, once per locale", () => {
		write("en/product/a.md", "# A\n");
		write("en/club/b.md", "# B\n");
		const snapshot = scan();
		const queue = buildQueue(project, snapshot, store);
		const value = volume([{ name: "docs", snapshot }], queue);

		expect(value.totals.targets).toBe(4);
		expect(value.totals.queued).toBe(4);
		expect(value.totals.chars).toBe(
			queue.reduce((s, j) => s + j.content.length, 0),
		);
		expect(value.locales.map((l) => l.locale)).toEqual(["de", "ru"]);
		expect(value.locales.every((l) => l.queued === 2)).toBe(true);
	});

	test("a linked translation leaves the queue and the estimate", () => {
		write("en/product/a.md", "# A\n");
		let snapshot = scan();
		const target = join(root, "cache", "ru", "product", "a.md");
		store.save(
			snapshot.files["product/a.md"]?.sourceHash as string,
			"ru",
			"# А\n",
			target,
		);
		snapshot = scan();

		const value = volume(
			[{ name: "docs", snapshot }],
			buildQueue(project, snapshot, store),
		);
		expect(value.totals.queued).toBe(1);
		expect(value.locales.find((l) => l.locale === "ru")?.queued).toBe(0);
		expect(value.locales.find((l) => l.locale === "de")?.queued).toBe(1);
	});

	test("folders are broken out largest first", () => {
		write("en/product/a.md", `# A\n${"x".repeat(500)}`);
		write("en/club/b.md", "# B\n");
		const snapshot = scan();
		const value = volume(
			[{ name: "docs", snapshot }],
			buildQueue(project, snapshot, store),
		);
		expect(value.folders[0]?.folder).toBe("product");
		expect(value.folders[0]?.queued).toBe(2);
		expect(value.folders[1]?.folder).toBe("club");
	});

	test("large JSON is counted on the string-level route", () => {
		const big = JSON.stringify(
			{
				items: Array.from({ length: 900 }, (_, i) => ({ title: `Item ${i}` })),
			},
			null,
			2,
		);
		expect(big.length).toBeGreaterThan(JSON_STRING_LEVEL_THRESHOLD);
		write("en/big.json", big);
		const snapshot = scan();
		const queue = buildQueue(project, snapshot, store);
		expect(queue.every((job) => routeFor(job) === "string-level")).toBe(true);

		const value = volume([{ name: "docs", snapshot }], queue);
		expect(
			value.locales.every((l) => l.stringLevel === 1 && l.wholeFile === 0),
		).toBe(true);
		expect(value.totals.requests).toBeGreaterThan(0);
	});

	test("every status the scan produced is accounted for", () => {
		write("en/a.md", "# A\n");
		const snapshot = scan();
		const value = volume([{ name: "docs", snapshot }], []);
		const counted = value.statuses.reduce((sum, s) => sum + s.count, 0);
		expect(counted).toBe(value.totals.targets);
	});

	test("nothing queued renders without throwing and says so", () => {
		write("en/a.md", "# A\n");
		const snapshot = scan();
		const text = renderVolume(volume([{ name: "docs", snapshot }], []));
		expect(text).toContain("0 of 2 targets queued");
	});
});

describe("the run ledger", () => {
	test("a run round-trips through the database", () => {
		const run = beginRun(store.db, "translate", {
			model: "test-model",
			concurrency: 4,
			queued: 12,
		});
		recordItem(run, {
			project: "docs",
			locale: "ru",
			rel: "a.md",
			route: "whole-file",
			chars: 100,
			ms: 50,
			ok: true,
		});
		finishRun(run, {
			translated: 11,
			skipped: 1,
			failed: 0,
			requests: 3,
			retries: 1,
			sourceChars: 1200,
		});

		const [row] = recentRuns(store.db);
		expect(row?.mode).toBe("translate");
		expect(row?.model).toBe("test-model");
		expect(row?.queued).toBe(12);
		expect(row?.translated).toBe(11);
		expect(row?.skipped).toBe(1);
		expect(row?.retries).toBe(1);
		expect(row?.finished_at).not.toBeNull();
		expect(
			store.db
				.query<{ count: number }, [number]>(
					"SELECT COUNT(*) AS count FROM run_item WHERE run_id = ?",
				)
				.get(run.id)?.count,
		).toBe(1);
	});

	test("an empty ledger renders a sentence, not an empty table", () => {
		expect(renderRuns(recentRuns(store.db))).toContain("no recorded runs");
	});
});
