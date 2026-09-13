/**
 * Content hashes memoized by identity on disk.
 *
 * A scan of both caches hashes roughly ten thousand files — every source once
 * and every locale copy of it. Almost none of them changed since the last run,
 * and reading them back only to arrive at the same digest is the single
 * largest cost of the pre-translate pass.
 *
 * Size plus mtime is the key. It is not a proof of equality, but it is the
 * same evidence `make` has always run on, and the cache lives beside the
 * files it describes: a checkout that rewrites mtimes invalidates itself,
 * which is the safe direction.
 */

import type { Database } from "bun:sqlite";
import { statSync } from "node:fs";
import { hashFile } from "./fs";

export type Hasher = {
	hash(path: string): string;
	/** Hits and misses since construction, for the run summary. */
	readonly hits: number;
	readonly misses: number;
	flush(): void;
};

/** Hashes every file, remembers nothing. Used by tests and by `--no-cache`. */
export function directHasher(): Hasher {
	let misses = 0;
	return {
		hash(path) {
			misses += 1;
			return hashFile(path);
		},
		get hits() {
			return 0;
		},
		get misses() {
			return misses;
		},
		flush() {},
	};
}

type Row = { bytes: number; mtime_ms: number; hash: string };

export function sqliteHasher(db: Database): Hasher {
	const select = db.query<Row, [string]>(
		"SELECT bytes, mtime_ms, hash FROM hash_cache WHERE path = ?",
	);
	const upsert = db.query(
		"INSERT INTO hash_cache (path, bytes, mtime_ms, hash) VALUES (?, ?, ?, ?) " +
			"ON CONFLICT(path) DO UPDATE SET bytes = excluded.bytes, mtime_ms = excluded.mtime_ms, hash = excluded.hash",
	);

	let hits = 0;
	let misses = 0;
	// Writes are buffered: a scan touches every file, and one transaction at
	// the end beats ten thousand implicit ones. `pending` doubles as the
	// first place a lookup looks, because a scan reads most paths twice —
	// once to hash the target, once to compare its shape — and a buffered
	// write the SELECT cannot see would make every second read a miss.
	const pending = new Map<string, Row>();

	const flush = () => {
		if (pending.size === 0) return;
		db.transaction(() => {
			for (const [path, row] of pending) {
				upsert.run(path, row.bytes, row.mtime_ms, row.hash);
			}
		})();
		pending.clear();
	};

	return {
		hash(path) {
			const stat = statSync(path);
			const bytes = stat.size;
			const mtimeMs = Math.floor(stat.mtimeMs);
			const cached = pending.get(path) ?? select.get(path);
			if (cached && cached.bytes === bytes && cached.mtime_ms === mtimeMs) {
				hits += 1;
				return cached.hash;
			}
			misses += 1;
			const hash = hashFile(path);
			pending.set(path, { bytes, mtime_ms: mtimeMs, hash });
			if (pending.size >= 2000) flush();
			return hash;
		},
		get hits() {
			return hits;
		},
		get misses() {
			return misses;
		},
		flush,
	};
}
