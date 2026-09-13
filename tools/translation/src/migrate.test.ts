/**
 * The migration is the one step that cannot be redone once the old directory
 * is gone, so it is tested against the shapes the real `.translation` trees
 * actually contain — including the pre-array format the runtime store used to
 * tolerate silently.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TranslationStore } from "./store";

const SCRIPT = join(import.meta.dir, "..", "scripts", "migrate-index.ts");

let root: string;
let cache: string;
let legacy: string;

const A = "a".repeat(64);
const B = "b".repeat(64);
const C = "c".repeat(64);
const D = "d".repeat(64);

function record(sourceHash: string, translations: unknown): void {
	writeFileSync(
		join(legacy, `${sourceHash}.json`),
		`${JSON.stringify({ version: 1, sourceHash, translations }, null, 2)}\n`,
		"utf8",
	);
}

async function run(...args: string[]) {
	const child = Bun.spawn([process.execPath, SCRIPT, ...args], {
		stdout: "pipe",
		stderr: "pipe",
	});
	const stdout = await new Response(child.stdout).text();
	return { code: await child.exited, stdout };
}

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "translation-migrate-"));
	cache = join(root, "docs-cache");
	legacy = join(cache, ".translation");
	mkdirSync(legacy, { recursive: true });
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("migrate-index", () => {
	test("every link survives, and --verify agrees", async () => {
		record(A, { ru: [B], de: [C, D] });
		record(B, { ru: [C] });

		const migrated = await run(cache);
		expect(migrated.code).toBe(0);
		expect(migrated.stdout).toContain("2 records → 4 links");

		const store = new TranslationStore(join(cache, ".index"));
		expect(store.read(A)?.translations).toEqual({ ru: [B], de: [C, D] });
		expect(store.read(B)?.translations).toEqual({ ru: [C] });
		store.close();

		const verified = await run("--verify", cache);
		expect(verified.code).toBe(0);
		expect(verified.stdout).toContain("0 missing");
	});

	test("the pre-array format is carried over, not dropped", async () => {
		record(A, { ru: { targetHash: B } });
		await run(cache);

		const store = new TranslationStore(join(cache, ".index"));
		expect(store.read(A)?.translations.ru).toEqual([B]);
		store.close();
	});

	test("the old directory is left exactly as it was", async () => {
		record(A, { ru: [B] });
		writeFileSync(join(legacy, "control.json"), '{"projects":[]}', "utf8");
		const before = await Bun.file(join(legacy, `${A}.json`)).text();

		await run(cache);

		expect(await Bun.file(join(legacy, `${A}.json`)).text()).toBe(before);
		expect(await Bun.file(join(legacy, "control.json")).exists()).toBe(true);
		// control.json is copied next to the database so a half-migrated
		// checkout can still be built from either location.
		expect(await Bun.file(join(cache, ".index", "control.json")).exists()).toBe(
			true,
		);
	});

	test("a second run refuses to touch a populated database without --force", async () => {
		record(A, { ru: [B] });
		await run(cache);
		record(C, { ru: [D] });

		const again = await run(cache);
		expect(again.stdout).toContain("already holds 1 links");

		const store = new TranslationStore(join(cache, ".index"));
		expect(store.read(C)).toBeUndefined();
		store.close();

		await run("--force", cache);
		const forced = new TranslationStore(join(cache, ".index"));
		expect(forced.read(C)?.translations.ru).toEqual([D]);
		forced.close();
	});

	test("a corrupt node is reported and skipped, not fatal", async () => {
		record(A, { ru: [B] });
		writeFileSync(join(legacy, `${C}.json`), "{ not json", "utf8");

		const migrated = await run(cache);
		expect(migrated.code).toBe(0);
		expect(migrated.stdout).toContain("SKIPPED");
		expect(migrated.stdout).toContain("1 records → 1 links");
	});

	test("--verify fails loudly when a link never made it", async () => {
		record(A, { ru: [B] });
		await run(cache);
		record(C, { ru: [D] });

		const verified = await run("--verify", cache);
		expect(verified.code).toBe(1);
		expect(verified.stdout).toContain("1 missing");
		expect(verified.stdout).toContain("do not delete .translation yet");
	});

	test("a cache with no legacy directory is a no-op", async () => {
		rmSync(legacy, { recursive: true });
		const migrated = await run(cache);
		expect(migrated.code).toBe(0);
		expect(migrated.stdout).toContain("nothing to migrate");
	});
});
