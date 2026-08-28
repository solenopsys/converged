/**
 * End-to-end over real files in a temporary tree.
 *
 * The first test pins the source-hash index behavior: it is the exact
 * sequence that used to end with a stale translation reported as `ok`.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { countIssues, scanProject } from "./scan";
import { TranslationStore } from "./store";
import type { ControlState, ProjectConfig, ProjectSnapshot } from "./types";

let root: string;
let configPath: string;
let state: ControlState;
let store: TranslationStore;

const project: ProjectConfig = {
	name: "docs",
	root: "./root",
	sourceLocale: "en",
	targetLocales: ["ru"],
};

function write(rel: string, content: string): void {
	const path = join(root, "root", rel);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content, "utf8");
}

function writeCache(rel: string, content: string): void {
	const path = join(root, "cache", rel);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content, "utf8");
}

function scan(): ProjectSnapshot {
	const snapshot = scanProject(project, configPath, state, store);
	state.projects[project.name] = snapshot;
	return snapshot;
}

function indexTranslation(snapshot: ProjectSnapshot, rel: string): void {
	const target = join(root, "root", "ru", rel);
	store.save(
		snapshot.files[rel]?.sourceHash as string,
		"ru",
		readFileSync(target, "utf8"),
		target,
	);
}

function statusOf(snapshot: ProjectSnapshot, rel: string, locale = "ru") {
	return snapshot.files[rel]?.targets[locale]?.status;
}

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "translation-"));
	configPath = join(root, "config.json");
	writeFileSync(configPath, JSON.stringify({ projects: [project] }), "utf8");
	state = { version: 1, updatedAt: "", projects: {} };
	store = new TranslationStore(join(root, ".translation", "index"));
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

describe("source-hash invalidation survives repeated scans", () => {
	test("a source edit invalidates its locale links forever", () => {
		write("en/notify.md", "# Notify\n\nSends notifications over channels.\n");
		write(
			"ru/notify.md",
			"# Уведомления\n\nОтправляет уведомления по каналам.\n",
		);

		indexTranslation(scan(), "notify.md");
		expect(statusOf(scan(), "notify.md")).toBe("ok");

		write(
			"en/notify.md",
			"# Notify\n\nSends notifications over channels, with delivery receipts.\n",
		);

		expect(statusOf(scan(), "notify.md")).toBe("unrecorded");
		expect(statusOf(scan(), "notify.md")).toBe("unrecorded");
		expect(statusOf(scan(), "notify.md")).toBe("unrecorded");
	});

	test("retranslating and indexing clears it", () => {
		write("en/notify.md", "# Notify\n\nSends notifications over channels.\n");
		write(
			"ru/notify.md",
			"# Уведомления\n\nОтправляет уведомления по каналам.\n",
		);
		indexTranslation(scan(), "notify.md");

		write("en/notify.md", "# Notify\n\nSends notifications, with receipts.\n");
		expect(statusOf(scan(), "notify.md")).toBe("unrecorded");

		write(
			"ru/notify.md",
			"# Уведомления\n\nОтправляет уведомления, с квитанциями.\n",
		);
		indexTranslation(scan(), "notify.md");
		expect(statusOf(scan(), "notify.md")).toBe("ok");
	});

	test("JSON is covered by the same rule", () => {
		write("en/ui.json", JSON.stringify({ note: "Choose how you get alerts." }));
		write(
			"ru/ui.json",
			JSON.stringify({ note: "Выберите способ оповещения." }),
		);
		indexTranslation(scan(), "ui.json");

		write(
			"en/ui.json",
			JSON.stringify({ note: "Choose how you get alerts, including SMS." }),
		);
		expect(statusOf(scan(), "ui.json")).toBe("unrecorded");
		expect(statusOf(scan(), "ui.json")).toBe("unrecorded");
	});
});

describe("scanning", () => {
	test("a target nobody recorded is unrecorded rather than ok", () => {
		write("en/a.md", "# A\n\nSome reasonably long English sentence here.\n");
		write("ru/a.md", "# А\n\nДостаточно длинное русское предложение здесь.\n");

		expect(statusOf(scan(), "a.md")).toBe("unrecorded");
	});

	test("a missing translation is reported as missing", () => {
		write("en/a.md", "# A\n\nSome reasonably long English sentence here.\n");

		const snapshot = scan();
		expect(statusOf(snapshot, "a.md")).toBe("missing");
		expect(countIssues(snapshot)).toBe(1);
	});

	test("a target with no source is an orphan", () => {
		write("en/a.md", "# A\n\nSome reasonably long English sentence here.\n");
		write("ru/a.md", "# А\n\nДостаточно длинное русское предложение здесь.\n");
		write(
			"ru/gone.md",
			"# Ушло\n\nИсходник этого файла удалили давным-давно.\n",
		);

		expect(scan().orphans.ru).toEqual(["gone.md"]);
	});

	test("markdown left in English is caught as untranslated", () => {
		const english =
			"# Notify\n\nSends notifications over channels to people.\n";
		write("en/a.md", english);
		write("ru/a.md", english);

		expect(statusOf(scan(), "a.md")).toBe("untranslated-text");
	});

	test("a dropped heading is structure drift", () => {
		write(
			"en/a.md",
			"# One\n\nПервый абзац здесь.\n\n## Two\n\nВторой абзац.\n",
		);
		write("ru/a.md", "# Один\n\nПервый абзац здесь на русском языке.\n");

		const snapshot = scan();
		expect(statusOf(snapshot, "a.md")).toBe("structure-drift");
		expect(snapshot.files["a.md"]?.targets.ru?.diff?.missing).toEqual([
			"/heading/1",
		]);
	});

	test("broken JSON is reported as invalid, not as drift", () => {
		write("en/a.json", JSON.stringify({ title: "Hello" }));
		write("ru/a.json", "{ not json");

		expect(statusOf(scan(), "a.json")).toBe("invalid-json");
	});

	test("include and exclude narrow the source set", () => {
		write(
			"en/keep/a.md",
			"# A\n\nЭто достаточно длинный текст для проверки.\n",
		);
		write("en/skip/b.md", "# B\n\nЭто тоже достаточно длинный текст здесь.\n");

		const snapshot = scanProject(
			{ ...project, include: ["keep"] },
			configPath,
			state,
			store,
		);
		expect(Object.keys(snapshot.files)).toEqual(["keep/a.md"]);
	});

	test("a missing source root is an error, not an empty result", () => {
		expect(() => scan()).toThrow(/source root does not exist/);
	});

	test("reads translations and finds orphans in a separate cache root", () => {
		write("en/a.md", "# A\n\nA source article lives beside the code.\n");
		writeCache("ru/a.md", "# А\n\nПеревод лежит в отдельном кэше.\n");
		writeCache("ru/gone.md", "# Ушло\n\nЭтот документ больше не существует.\n");

		const snapshot = scanProject(
			{ ...project, targetRoot: "./cache" },
			configPath,
			state,
			store,
		);

		expect(snapshot.root).toBe(join(root, "root"));
		expect(snapshot.targetRoot).toBe(join(root, "cache"));
		expect(statusOf(snapshot, "a.md")).toBe("unrecorded");
		expect(snapshot.orphans.ru).toEqual(["gone.md"]);
	});

	test("reads an unlocalized source tree when sourcePath is dot", () => {
		write("guide.md", "# Guide\n\nEnglish source article.\n");
		writeCache("ru/guide.md", "# Руководство\n\nРусский перевод.\n");

		const snapshot = scanProject(
			{
				...project,
				sourcePath: ".",
				targetRoot: "./cache",
			},
			configPath,
			state,
			store,
		);

		expect(statusOf(snapshot, "guide.md")).toBe("unrecorded");
	});

	test("maps one module source into its owner directory in the cache", () => {
		write(
			"en/modules/ms-sales.md",
			"# Sales\n\nOwns the production sales lifecycle.\n",
		);
		writeCache(
			"ru/modules/ms-sales/ms-sales.md",
			"# Продажи\n\nВладеет жизненным циклом продаж производства.\n",
		);

		const snapshot = scanProject(
			{
				...project,
				targetRoot: "./cache",
				targetPrefix: "modules/ms-sales",
				targetStripPrefix: "modules",
			},
			configPath,
			state,
			store,
		);

		expect(statusOf(snapshot, "modules/ms-sales.md")).toBe("unrecorded");
		expect(snapshot.orphans.ru).toEqual([]);
	});
});
