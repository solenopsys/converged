#!/usr/bin/env bun
/**
 * One-shot migration: `.translation/<sourceHash>.json` → `.index/index.sqlite`.
 *
 *   bun run scripts/migrate-index.ts <docs-cache>...            # migrate
 *   bun run scripts/migrate-index.ts --verify <docs-cache>...   # compare only
 *   bun run scripts/migrate-index.ts --force <docs-cache>...    # rewrite links
 *
 * Deliberately additive. It reads the old directory, writes the new database
 * and touches nothing else — the old `.translation` tree is still there
 * afterwards, byte for byte, and deleting it is a separate decision made
 * after `--verify` says the two agree.
 *
 * `control.json` is copied rather than moved for the same reason: the docs
 * build regenerates it on every run, and leaving the old copy in place keeps
 * a half-migrated checkout buildable.
 */

import {
	copyFileSync,
	existsSync,
	readdirSync,
	readFileSync,
	statSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";
import { closeIndex, openIndex } from "../src/db";
import type { TranslationRecord } from "../src/store";

const LEGACY_DIR = ".translation";
const INDEX_DIR = ".index";
const RECORD = /^[a-f0-9]{64}\.json$/;

type Link = { sourceHash: string; locale: string; targetHash: string };

type Reading = {
	links: Link[];
	records: number;
	skipped: string[];
};

/** Read the old directory into flat links, tolerating the pre-array format. */
function readLegacy(dir: string): Reading {
	const links: Link[] = [];
	const skipped: string[] = [];
	let records = 0;

	for (const name of readdirSync(dir).sort()) {
		if (!RECORD.test(name)) continue;
		const path = join(dir, name);
		let record: TranslationRecord;
		try {
			record = JSON.parse(readFileSync(path, "utf8")) as TranslationRecord;
		} catch (error) {
			skipped.push(`${name}: unreadable (${(error as Error).message})`);
			continue;
		}
		const sourceHash = name.slice(0, -5);
		if (record.version !== 1 || !record.translations) {
			skipped.push(`${name}: not a v1 record`);
			continue;
		}
		if (record.sourceHash !== sourceHash) {
			skipped.push(
				`${name}: sourceHash field ${record.sourceHash} disagrees with filename`,
			);
			continue;
		}
		records += 1;
		for (const [locale, value] of Object.entries(record.translations)) {
			// The very first format stored one object per locale rather than an
			// array. The runtime store already tolerated it, so the migration
			// has to as well or those links are silently dropped.
			const list = Array.isArray(value)
				? value
				: (value as { targetHash?: string }).targetHash
					? [(value as { targetHash?: string }).targetHash as string]
					: [];
			for (const targetHash of list) {
				if (!/^[a-f0-9]{64}$/.test(targetHash)) {
					skipped.push(`${name}: ${locale} link is not a SHA-256`);
					continue;
				}
				links.push({ sourceHash, locale, targetHash });
			}
		}
	}
	return { links, records, skipped };
}

function migrate(cache: string, options: { verify: boolean; force: boolean }) {
	const legacy = join(cache, LEGACY_DIR);
	const indexRoot = join(cache, INDEX_DIR);
	// Both caches are called `docs-cache`; the project above them is the name.
	const label = relative(resolve(cache, "../../.."), cache) || cache;

	if (!existsSync(legacy)) {
		console.log(`${label}: no ${LEGACY_DIR} directory, nothing to migrate`);
		return { ok: true, links: 0 };
	}

	const reading = readLegacy(legacy);
	const db = openIndex(indexRoot);
	let wrote = 0;
	let ok = true;

	try {
		const existing = db
			.query<{ count: number }, []>("SELECT COUNT(*) AS count FROM translation")
			.get()?.count as number;

		if (options.verify) {
			const missing: Link[] = [];
			const check = db.query<{ one: number }, [string, string, string]>(
				"SELECT 1 AS one FROM translation WHERE source_hash = ? AND locale = ? AND target_hash = ?",
			);
			for (const link of reading.links) {
				if (!check.get(link.sourceHash, link.locale, link.targetHash)) {
					missing.push(link);
				}
			}
			ok = missing.length === 0;
			console.log(
				`${label}: ${reading.records} legacy records, ${reading.links.length} links; ` +
					`database holds ${existing}; ${missing.length} missing`,
			);
			for (const link of missing.slice(0, 10)) {
				console.log(
					`  MISSING ${link.sourceHash.slice(0, 12)}… ${link.locale} → ${link.targetHash.slice(0, 12)}…`,
				);
			}
			if (missing.length > 10) {
				console.log(`  … ${missing.length - 10} more`);
			}
			return { ok, links: reading.links.length };
		}

		if (existing > 0 && !options.force) {
			console.log(
				`${label}: ${indexRoot} already holds ${existing} links — pass --force to write over them`,
			);
			return { ok: true, links: existing };
		}

		const insert = db.query(
			"INSERT OR IGNORE INTO translation (source_hash, locale, target_hash, created_at) VALUES (?, ?, ?, ?)",
		);
		db.transaction(() => {
			if (options.force) db.query("DELETE FROM translation").run();
			for (const link of reading.links) {
				// The legacy node's mtime is the only date the old format kept,
				// and it is a better `created_at` than "now": run statistics
				// read this column to order links by age.
				const at = statSync(
					join(legacy, `${link.sourceHash}.json`),
				).mtime.toISOString();
				const result = insert.run(
					link.sourceHash,
					link.locale,
					link.targetHash,
					at,
				);
				wrote += result.changes;
			}
		})();

		const control = join(legacy, "control.json");
		if (existsSync(control)) {
			copyFileSync(control, join(indexRoot, "control.json"));
			console.log(`${label}: copied control.json into ${INDEX_DIR}/`);
		}

		console.log(
			`${label}: ${reading.records} records → ${wrote} links in ${join(indexRoot, "index.sqlite")}`,
		);
		for (const note of reading.skipped) console.log(`  SKIPPED ${note}`);
	} finally {
		closeIndex(db, !options.verify);
	}
	return { ok, links: wrote };
}

const argv = Bun.argv.slice(2);
const verify = argv.includes("--verify");
const force = argv.includes("--force");
const caches = argv
	.filter((arg) => !arg.startsWith("--"))
	.map((p) => resolve(p));

if (caches.length === 0) {
	console.error(
		"usage: bun run scripts/migrate-index.ts [--verify] [--force] <docs-cache>...",
	);
	process.exit(2);
}

let failed = false;
for (const cache of caches) {
	if (!existsSync(cache)) {
		console.error(`${cache}: no such directory`);
		failed = true;
		continue;
	}
	const result = migrate(cache, { verify, force });
	if (!result.ok) failed = true;
}

console.log(
	verify
		? failed
			? "Verify FAILED — do not delete .translation yet."
			: "Verify OK — every legacy link is present in the database."
		: "Migration written. Run again with --verify before deleting .translation.",
);
process.exit(failed ? 1 : 0);
