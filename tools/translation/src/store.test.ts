/**
 * The SQLite index: links, placement, folder invalidation and the hash cache.
 *
 * These are the facts the directory of `<sourceHash>.json` nodes used to
 * carry, plus the two it could not — where a file lives, and whether it has
 * changed since it was last hashed.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	utimesSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { INDEX_FILE } from "./db";
import { hashText } from "./fs";
import { directHasher, sqliteHasher } from "./hashcache";
import {
	dirOf,
	folders,
	invalidateFolder,
	previousSnapshot,
	recordProject,
} from "./placement";
import { TranslationStore } from "./store";
import type { ProjectConfig, ProjectSnapshot } from "./types";

let root: string;
let store: TranslationStore;

const A = "a".repeat(64);
const B = "b".repeat(64);
const C = "c".repeat(64);

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "translation-store-"));
	store = new TranslationStore(join(root, ".index"));
});

afterEach(() => {
	store.close();
	rmSync(root, { recursive: true, force: true });
});

describe("links", () => {
	test("the database is one file inside the index directory", () => {
		expect(Bun.file(join(root, ".index", INDEX_FILE)).size).toBeGreaterThan(0);
	});

	test("a saved translation is linked and readable back in record shape", () => {
		const target = join(root, "cache", "ru", "a.md");
		const hash = store.save(A, "ru", "переведено", target);

		expect(hash).toBe(hashText("переведено"));
		expect(store.has(A, "ru", hash)).toBe(true);
		expect(store.verdict(A, "ru", hash)).toBe("ok");
		expect(store.read(A)).toEqual({
			version: 1,
			sourceHash: A,
			translations: { ru: [hash] },
		});
		expect(Bun.file(target).size).toBeGreaterThan(0);
	});

	test("an unknown source hash reads back as undefined, not an empty record", () => {
		expect(store.read(A)).toBeUndefined();
		expect(store.verdict(A, "ru", B)).toBe("unrecorded");
	});

	test("two targets of one source in one locale both survive", () => {
		store.link(A, "ru", B);
		store.link(A, "ru", C);
		expect(store.read(A)?.translations.ru).toEqual([B, C]);
	});

	test("forget drops one locale and leaves the others", () => {
		store.link(A, "ru", B);
		store.link(A, "de", C);
		expect(store.forget(A, "ru")).toBe(true);
		expect(store.read(A)?.translations).toEqual({ de: [C] });
		expect(store.forget(A)).toBe(true);
		expect(store.read(A)).toBeUndefined();
		expect(store.forget(A)).toBe(false);
	});

	test("a malformed hash is rejected rather than stored", () => {
		expect(() => store.save("nope", "ru", "x", join(root, "x"))).toThrow(
			/Invalid SHA-256/,
		);
	});

	test("knownTargets is the reverse lookup reindex needs", () => {
		store.link(A, "ru", B);
		store.link(C, "de", B);
		expect(store.knownTargets().get(`ru:${B}`)).toBe(A);
		expect(store.knownTargets().get(`de:${B}`)).toBe(C);
	});

	test("rebuild without prune keeps links the caller did not scan", () => {
		store.link(A, "ru", B);
		store.rebuild(
			[{ version: 1, sourceHash: C, translations: { ru: [B] } }],
			false,
		);
		expect(store.has(A, "ru", B)).toBe(true);
		expect(store.has(C, "ru", B)).toBe(true);
	});

	test("rebuild with prune drops what the records omit", () => {
		store.link(A, "ru", B);
		store.rebuild([{ version: 1, sourceHash: C, translations: { ru: [B] } }]);
		expect(store.has(A, "ru", B)).toBe(false);
		expect(store.has(C, "ru", B)).toBe(true);
	});
});

/* ── placement ────────────────────────────────────────────────────────── */

const project: ProjectConfig = {
	name: "docs",
	root: "./root",
	sourceLocale: "en",
	targetLocales: ["ru", "de"],
};

function snapshot(
	files: Record<string, { hash: string; targets: Record<string, string> }>,
): ProjectSnapshot {
	return {
		root: join(root, "root"),
		targetRoot: join(root, "cache"),
		sourceLocale: "en",
		targetLocales: ["ru", "de"],
		files: Object.fromEntries(
			Object.entries(files).map(([rel, file]) => [
				rel,
				{
					fileType: "markdown" as const,
					sourceHash: file.hash,
					bytes: 10,
					mtimeMs: 1,
					targets: Object.fromEntries(
						Object.entries(file.targets).map(([locale, hash]) => [
							locale,
							{
								exists: true,
								hash,
								status: "ok" as const,
								reasons: [],
								bytes: 10,
							},
						]),
					),
				},
			]),
		),
		orphans: {},
		routes: [],
	};
}

describe("placement", () => {
	test("dirOf is the folder key, empty at the root", () => {
		expect(dirOf("product/a.md")).toBe("product");
		expect(dirOf("product/deep/a.md")).toBe("product/deep");
		expect(dirOf("a.md")).toBe("");
	});

	test("a rescan replaces placement rather than accumulating it", () => {
		recordProject(
			store,
			project,
			snapshot({ "product/a.md": { hash: A, targets: { ru: B } } }),
		);
		recordProject(
			store,
			project,
			snapshot({ "club/b.md": { hash: C, targets: { ru: B } } }),
		);
		expect(folders(store)).toEqual(["club"]);
	});

	test("the previous scan is readable back as evidence for the next one", () => {
		recordProject(
			store,
			project,
			snapshot({ "product/a.md": { hash: A, targets: { ru: B, de: C } } }),
		);
		const previous = previousSnapshot(store, "docs");
		expect(previous?.files["product/a.md"]?.sourceHash).toBe(A);
		expect(previous?.files["product/a.md"]?.targets.ru?.status).toBe("ok");
		expect(previous?.targetLocales).toEqual(["de", "ru"]);
		expect(previousSnapshot(store, "absent")).toBeUndefined();
	});
});

describe("folder invalidation", () => {
	beforeEach(() => {
		recordProject(
			store,
			project,
			snapshot({
				"product/a.md": { hash: A, targets: { ru: B, de: C } },
				"product/deep/b.md": { hash: B, targets: { ru: C } },
				"club/c.md": { hash: C, targets: { ru: A } },
			}),
		);
		store.link(A, "ru", B);
		store.link(A, "de", C);
		store.link(B, "ru", C);
		store.link(C, "ru", A);
	});

	test("a folder takes its subfolders with it and leaves siblings alone", () => {
		const result = invalidateFolder(store, "product");
		expect(result.sources).toBe(2);
		expect(result.links).toBe(3);
		expect(store.read(A)).toBeUndefined();
		expect(store.read(B)).toBeUndefined();
		expect(store.read(C)?.translations.ru).toEqual([A]);
	});

	test("one locale can be dropped without touching the others", () => {
		const result = invalidateFolder(store, "product", { locale: "ru" });
		expect(result.links).toBe(2);
		expect(result.locales).toEqual(["ru"]);
		expect(store.read(A)?.translations).toEqual({ de: [C] });
	});

	test("a leading ./ or trailing / is not a different folder", () => {
		expect(invalidateFolder(store, "./product/").links).toBe(3);
	});

	test("a folder nobody has is a no-op, not an error", () => {
		expect(invalidateFolder(store, "nowhere")).toEqual({
			sources: 0,
			links: 0,
			locales: [],
		});
	});

	test("an unrelated project's links are spared by --project", () => {
		recordProject(
			store,
			{ ...project, name: "other" },
			snapshot({ "product/z.md": { hash: C, targets: { ru: A } } }),
		);
		invalidateFolder(store, "product", { project: "other" });
		// C is the only source `other` places under product/, so A and B stay.
		expect(store.read(A)?.translations.ru).toEqual([B]);
		expect(store.read(C)).toBeUndefined();
	});
});

/* ── hash cache ───────────────────────────────────────────────────────── */

describe("hash cache", () => {
	function file(rel: string, content: string): string {
		const path = join(root, rel);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, content, "utf8");
		return path;
	}

	test("a second look at an unchanged file is a hit, and agrees", () => {
		const hasher = sqliteHasher(store.db);
		const path = file("a.md", "hello");
		expect(hasher.hash(path)).toBe(hashText("hello"));
		expect(hasher.hash(path)).toBe(hashText("hello"));
		expect(hasher.hits).toBe(1);
		expect(hasher.misses).toBe(1);
	});

	test("a rewrite that moves size or mtime is a miss", () => {
		const hasher = sqliteHasher(store.db);
		const path = file("a.md", "hello");
		hasher.hash(path);
		writeFileSync(path, "hello there", "utf8");
		expect(hasher.hash(path)).toBe(hashText("hello there"));
		expect(hasher.misses).toBe(2);
	});

	test("the cache survives the process that wrote it", () => {
		const path = file("a.md", "hello");
		const first = sqliteHasher(store.db);
		first.hash(path);
		first.flush();
		const second = sqliteHasher(store.db);
		expect(second.hash(path)).toBe(hashText("hello"));
		expect(second.hits).toBe(1);
	});

	test("a same-size rewrite at the same mtime is the known blind spot", () => {
		const hasher = sqliteHasher(store.db);
		const path = file("a.md", "aaaaa");
		const stamp = new Date(1_700_000_000_000);
		utimesSync(path, stamp, stamp);
		hasher.hash(path);
		writeFileSync(path, "bbbbb", "utf8");
		utimesSync(path, stamp, stamp);
		// Documented, not desired: size+mtime is evidence, not proof. `--no-cache`
		// exists for the runs that cannot accept it.
		expect(hasher.hash(path)).toBe(hashText("aaaaa"));
		expect(directHasher().hash(path)).toBe(hashText("bbbbb"));
	});
});
