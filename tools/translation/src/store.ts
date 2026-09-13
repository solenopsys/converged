/** Content-addressed translation links, held in the SQLite index. */

import type { Database } from "bun:sqlite";
import { closeIndex, openIndex } from "./db";
import { hashText, writeTextAtomic } from "./fs";

export type TranslationRecord = {
	version: 1;
	sourceHash: string;
	translations: Record<string, string[]>;
};

export type StoreVerdict = "ok" | "unrecorded";

function assertHash(hash: string): void {
	if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error(`Invalid SHA-256: ${hash}`);
}

export class TranslationStore {
	readonly db: Database;
	/** Set when this run wrote links, so `close` compacts the committed file. */
	private dirty = false;

	/** `indexRoot` is the `.index` directory; the database lives inside it. */
	constructor(readonly indexRoot: string) {
		this.db = openIndex(indexRoot);
	}

	/**
	 * The record shape the JSON nodes used, rebuilt from rows. Kept because it
	 * is what `rebuild` takes and what the migration writes, not because
	 * anything still stores it that way.
	 */
	read(sourceHash: string): TranslationRecord | undefined {
		assertHash(sourceHash);
		const rows = this.db
			.query<{ locale: string; target_hash: string }, [string]>(
				"SELECT locale, target_hash FROM translation WHERE source_hash = ? ORDER BY locale, target_hash",
			)
			.all(sourceHash);
		if (rows.length === 0) return undefined;
		const translations: Record<string, string[]> = {};
		for (const row of rows) {
			const links = translations[row.locale] ?? [];
			links.push(row.target_hash);
			translations[row.locale] = links;
		}
		return { version: 1, sourceHash, translations };
	}

	has(sourceHash: string, locale: string, targetHash: string): boolean {
		if (!targetHash) return false;
		return (
			this.db
				.query<{ one: number }, [string, string, string]>(
					"SELECT 1 AS one FROM translation WHERE source_hash = ? AND locale = ? AND target_hash = ?",
				)
				.get(sourceHash, locale, targetHash) !== null
		);
	}

	verdict(
		sourceHash: string,
		locale: string,
		targetHash: string,
	): StoreVerdict {
		if (this.has(sourceHash, locale, targetHash)) return "ok";
		return "unrecorded";
	}

	/**
	 * Every `locale:targetHash` pair already on file and the source it was
	 * linked to. One indexed query where the directory format needed a readdir
	 * plus a JSON parse per node.
	 */
	knownTargets(): Map<string, string> {
		const known = new Map<string, string>();
		const rows = this.db
			.query<{ locale: string; target_hash: string; source_hash: string }, []>(
				"SELECT locale, target_hash, source_hash FROM translation ORDER BY created_at, source_hash, locale, target_hash",
			)
			.all();
		for (const row of rows) {
			const key = `${row.locale}:${row.target_hash}`;
			if (!known.has(key)) known.set(key, row.source_hash);
		}
		return known;
	}

	/**
	 * Adopt the given links. Returns the number of source hashes whose link
	 * set changed, so the reindex log keeps meaning what it meant when a
	 * source hash was one file.
	 *
	 * `prune` drops links no record mentions, which is only correct when the
	 * caller scanned every project sharing this index. One index serves about
	 * a hundred module projects here, so a `--project`-filtered reindex must
	 * pass false or it deletes the ninety-nine it did not look at.
	 */
	rebuild(records: Iterable<TranslationRecord>, prune = true): number {
		const next = new Map(
			[...records].map((record) => [record.sourceHash, record]),
		);
		const before = this.snapshotBySource();
		const now = new Date().toISOString();

		this.db.transaction(() => {
			if (prune) this.db.query("DELETE FROM translation").run();
			const insert = this.db.query(
				"INSERT OR IGNORE INTO translation (source_hash, locale, target_hash, created_at) VALUES (?, ?, ?, ?)",
			);
			for (const record of next.values()) {
				assertHash(record.sourceHash);
				for (const [locale, links] of Object.entries(record.translations)) {
					for (const targetHash of links) {
						insert.run(record.sourceHash, locale, targetHash, now);
					}
				}
			}
		})();
		this.dirty = true;

		const after = this.snapshotBySource();
		let changed = 0;
		for (const key of new Set([...before.keys(), ...after.keys()])) {
			if (before.get(key) !== after.get(key)) changed += 1;
		}
		return changed;
	}

	/** `sourceHash → canonical link set`, for cheap before/after comparison. */
	private snapshotBySource(): Map<string, string> {
		const rows = this.db
			.query<{ source_hash: string; links: string }, []>(
				"SELECT source_hash, group_concat(locale || ':' || target_hash) AS links FROM (SELECT source_hash, locale, target_hash FROM translation ORDER BY source_hash, locale, target_hash) GROUP BY source_hash",
			)
			.all();
		return new Map(rows.map((row) => [row.source_hash, row.links]));
	}

	/**
	 * Drop translation links the validator proved bogus. Removing a locale
	 * requeues the file for the next `-t` run; omitting it drops every locale.
	 * Returns true when anything was removed.
	 */
	forget(sourceHash: string, locale?: string): boolean {
		assertHash(sourceHash);
		const result =
			locale === undefined
				? this.db
						.query("DELETE FROM translation WHERE source_hash = ?")
						.run(sourceHash)
				: this.db
						.query(
							"DELETE FROM translation WHERE source_hash = ? AND locale = ?",
						)
						.run(sourceHash, locale);
		if (result.changes > 0) this.dirty = true;
		return result.changes > 0;
	}

	save(
		sourceHash: string,
		locale: string,
		content: string,
		target: string,
	): string {
		assertHash(sourceHash);
		const targetHash = hashText(content);
		writeTextAtomic(target, content);
		this.link(sourceHash, locale, targetHash);
		return targetHash;
	}

	link(sourceHash: string, locale: string, targetHash: string): void {
		this.db
			.query(
				"INSERT OR IGNORE INTO translation (source_hash, locale, target_hash, created_at) VALUES (?, ?, ?, ?)",
			)
			.run(sourceHash, locale, targetHash, new Date().toISOString());
		this.dirty = true;
	}

	/** Number of distinct source hashes carrying at least one link. */
	linkedSources(): number {
		return (
			this.db
				.query<{ count: number }, []>(
					"SELECT COUNT(DISTINCT source_hash) AS count FROM translation",
				)
				.get()?.count ?? 0
		);
	}

	markDirty(): void {
		this.dirty = true;
	}

	close(): void {
		closeIndex(this.db, this.dirty);
	}
}
