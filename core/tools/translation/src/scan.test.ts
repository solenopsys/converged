/**
 * End-to-end over real files in a temporary tree.
 *
 * The first test is the regression that motivated the ledger: it is the exact
 * sequence that used to end with a stale translation reported as `ok`.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { emptyLedger } from "./ledger";
import { countIssues, recordProject, scanProject } from "./scan";
import type {
	ControlState,
	ProjectConfig,
	ProjectSnapshot,
	TranslationLedger,
} from "./types";

let root: string;
let configPath: string;
let state: ControlState;
let ledger: TranslationLedger;

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

function scan(): ProjectSnapshot {
	const snapshot = scanProject(project, configPath, state, ledger);
	state.projects[project.name] = snapshot;
	return snapshot;
}

function statusOf(snapshot: ProjectSnapshot, rel: string, locale = "ru") {
	return snapshot.files[rel]?.targets[locale]?.status;
}

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "translation-"));
	configPath = join(root, "config.json");
	writeFileSync(configPath, JSON.stringify({ projects: [project] }), "utf8");
	state = { version: 1, updatedAt: "", projects: {} };
	ledger = emptyLedger();
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

describe("staleness survives repeated scans", () => {
	test("a source edited after translation stays flagged forever", () => {
		write("en/notify.md", "# Notify\n\nSends notifications over channels.\n");
		write(
			"ru/notify.md",
			"# Уведомления\n\nОтправляет уведомления по каналам.\n",
		);

		// A translation pass happened: the ledger now knows what it was made from.
		recordProject(scan(), ledger, project.name, "2026-01-01T00:00:00.000Z");
		expect(statusOf(scan(), "notify.md")).toBe("ok");

		write(
			"en/notify.md",
			"# Notify\n\nSends notifications over channels, with delivery receipts.\n",
		);

		// This is where the old behaviour broke: the second scan cleared it.
		expect(statusOf(scan(), "notify.md")).toBe("stale");
		expect(statusOf(scan(), "notify.md")).toBe("stale");
		expect(statusOf(scan(), "notify.md")).toBe("stale");
	});

	test("retranslating and recording clears it", () => {
		write("en/notify.md", "# Notify\n\nSends notifications over channels.\n");
		write(
			"ru/notify.md",
			"# Уведомления\n\nОтправляет уведомления по каналам.\n",
		);
		recordProject(scan(), ledger, project.name, "2026-01-01T00:00:00.000Z");

		write("en/notify.md", "# Notify\n\nSends notifications, with receipts.\n");
		expect(statusOf(scan(), "notify.md")).toBe("stale");

		write(
			"ru/notify.md",
			"# Уведомления\n\nОтправляет уведомления, с квитанциями.\n",
		);
		recordProject(scan(), ledger, project.name, "2026-01-02T00:00:00.000Z");
		expect(statusOf(scan(), "notify.md")).toBe("ok");
	});

	test("JSON is covered by the same rule", () => {
		write("en/ui.json", JSON.stringify({ note: "Choose how you get alerts." }));
		write(
			"ru/ui.json",
			JSON.stringify({ note: "Выберите способ оповещения." }),
		);
		recordProject(scan(), ledger, project.name, "2026-01-01T00:00:00.000Z");

		write(
			"en/ui.json",
			JSON.stringify({ note: "Choose how you get alerts, including SMS." }),
		);
		expect(statusOf(scan(), "ui.json")).toBe("stale");
		expect(statusOf(scan(), "ui.json")).toBe("stale");
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
			ledger,
		);
		expect(Object.keys(snapshot.files)).toEqual(["keep/a.md"]);
	});

	test("recording skips targets that do not exist", () => {
		write("en/a.md", "# A\n\nSome reasonably long English sentence here.\n");

		expect(
			recordProject(scan(), ledger, project.name, "2026-01-01T00:00:00.000Z"),
		).toBe(0);
	});

	test("a missing source root is an error, not an empty result", () => {
		expect(() => scan()).toThrow(/source root does not exist/);
	});
});
