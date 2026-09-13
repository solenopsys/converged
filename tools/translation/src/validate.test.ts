import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
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
import type { ProjectConfig, ProjectSnapshot } from "./types";
import { validateProject } from "./validate";

const hash = (text: string) => createHash("sha256").update(text).digest("hex");

function write(root: string, files: Record<string, string>): void {
	for (const [rel, content] of Object.entries(files)) {
		const path = join(root, rel);
		mkdirSync(join(path, ".."), { recursive: true });
		writeFileSync(path, content);
	}
}

/** A project whose sources sit in `docs/` and targets in `cache/<locale>/`. */
function setup(files: Record<string, string>): {
	root: string;
	project: ProjectConfig;
	snapshot: ProjectSnapshot;
	store: TranslationStore;
} {
	const root = mkdtempSync(join(tmpdir(), "validate-"));
	write(root, files);
	const project: ProjectConfig = {
		name: "docs",
		root: ".",
		sourcePath: ".",
		targetRoot: "./cache",
		sourceLocale: "en",
		targetLocales: ["ru", "de"],
	};
	const snapshot: ProjectSnapshot = {
		root,
		targetRoot: join(root, "cache"),
		sourceLocale: "en",
		targetLocales: ["ru", "de"],
		files: {},
		orphans: { ru: [], de: [] },
		routes: [],
	};
	for (const [rel, content] of Object.entries(files)) {
		if (!rel.startsWith("docs/")) continue;
		const key = rel.slice("docs/".length);
		const targets: ProjectSnapshot["files"][string]["targets"] = {};
		for (const locale of ["ru", "de"]) {
			let target: (typeof targets)[string];
			try {
				const text = readFileSync(join(root, "cache", locale, key), "utf8");
				target = { exists: true, hash: hash(text), status: "ok", reasons: [] };
			} catch {
				target = { exists: false, hash: "", status: "missing", reasons: [] };
			}
			targets[locale] = target;
		}
		snapshot.files[key] = {
			fileType: key.endsWith(".json") ? "json" : "markdown",
			sourceHash: hash(content),
			targets,
		};
	}
	return {
		root,
		project,
		snapshot,
		store: new TranslationStore(join(root, ".translation")),
	};
}

test("flags a byte-identical copy only once the index links it", () => {
	const { root, project, snapshot, store } = setup({
		"docs/a.json": '{"title":"Hello world, this is a long English heading"}',
		"cache/ru/a.json":
			'{"title":"Hello world, this is a long English heading"}',
	});
	try {
		// Unlinked, an identical copy is honest queue, not a lie.
		expect(validateProject(project, snapshot, store)).toEqual([]);

		const sourceHash = snapshot.files["a.json"].sourceHash;
		const content = readFileSync(join(root, "docs", "a.json"), "utf8");
		store.save(sourceHash, "ru", content, join(root, "cache", "ru", "a.json"));

		const issues = validateProject(project, snapshot, store);
		expect(issues.map((issue) => issue.kind)).toEqual(["fallback-identical"]);
		expect(issues[0].locale).toBe("ru");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("resolves a bare id against the folder its index came from", () => {
	const { root, project, snapshot, store } = setup({
		"cache/ru/guide/index.json": JSON.stringify([
			{ slug: "real", title: "Real", order: 0, id: "real" },
			{ slug: "ghost", title: "Ghost", order: 1, id: "ghost" },
		]),
		"cache/ru/guide/real.md": "# Real\n",
	});
	try {
		const issues = validateProject(project, snapshot, store);
		expect(issues.map((issue) => issue.kind)).toEqual(["missing-index-file"]);
		expect(issues[0].detail).toContain("ghost");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

/**
 * The layout that made the old validator delete whole indexes: entries carry a
 * locale-relative key WITH its extension, and the document lives in a sibling
 * store. Nothing resolves beside the index, and nothing here is broken.
 */
test("resolves a split struct/markdown store through indexContentRoot", () => {
	const root = mkdtempSync(join(tmpdir(), "validate-split-"));
	write(root, {
		"cache/struct/ru/club/index.json": JSON.stringify([
			{ slug: "intro", title: "Клуб", order: 0, id: "club/intro.md" },
			{ slug: "gone", title: "Нет", order: 1, id: "club/gone.md" },
		]),
		"cache/markdown/ru/club/intro.md": "# Клуб\n",
	});
	const project: ProjectConfig = {
		name: "club-struct",
		root: ".",
		sourcePath: ".",
		targetRoot: "./cache/struct",
		indexContentRoot: "../markdown",
		sourceLocale: "en",
		targetLocales: ["ru"],
	};
	const snapshot: ProjectSnapshot = {
		root,
		targetRoot: join(root, "cache", "struct"),
		sourceLocale: "en",
		targetLocales: ["ru"],
		files: {},
		orphans: { ru: [] },
		routes: [],
	};
	const store = new TranslationStore(join(root, ".translation"));
	try {
		const issues = validateProject(project, snapshot, store);
		// Only the genuinely absent document is reported; `club/intro.md`
		// resolves in the sibling store and must stay silent.
		expect(issues.map((issue) => issue.detail)).toEqual([
			'index entry "club/gone.md" resolves to no document',
		]);
		expect(issues[0].file).toBe(
			join(root, "cache", "struct", "ru", "club", "index.json"),
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("never writes: a validated tree is byte-identical afterwards", () => {
	const index = JSON.stringify([
		{ slug: "ghost", title: "Ghost", order: 0, id: "ghost" },
	]);
	const { root, project, snapshot, store } = setup({
		"cache/ru/guide/index.json": index,
	});
	try {
		expect(validateProject(project, snapshot, store).length).toBe(1);
		expect(
			readFileSync(join(root, "cache", "ru", "guide", "index.json"), "utf8"),
		).toBe(index);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("skips pdf, which is an output format rather than a language", () => {
	const root = mkdtempSync(join(tmpdir(), "validate-pdf-"));
	write(root, {
		"cache/pdf/guide/index.json": JSON.stringify([
			{ slug: "ghost", title: "Ghost", order: 0, id: "ghost" },
		]),
	});
	const project: ProjectConfig = {
		name: "docs",
		root: ".",
		sourcePath: ".",
		targetRoot: "./cache",
		sourceLocale: "en",
		targetLocales: ["pdf"],
	};
	const snapshot: ProjectSnapshot = {
		root,
		targetRoot: join(root, "cache"),
		sourceLocale: "en",
		targetLocales: ["pdf"],
		files: {},
		orphans: {},
		routes: [],
	};
	try {
		expect(
			validateProject(
				project,
				snapshot,
				new TranslationStore(join(root, ".t")),
			),
		).toEqual([]);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
