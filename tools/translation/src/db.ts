/**
 * The translation index as one SQLite file per content cache.
 *
 * It replaces a directory of `<sourceHash>.json` nodes. Same facts, four
 * reasons to move:
 *
 * - the reverse lookup `locale:targetHash → sourceHash`, which reindex needs
 *   for every target, was a full directory read and JSON parse per run;
 * - nothing recorded *where* a file lives, so "retranslate this folder" had
 *   no query to run — the placement tables below give it one;
 * - a content hash per file was recomputed on every scan even when neither
 *   size nor mtime moved;
 * - per-run statistics had nowhere durable to go.
 *
 * The file is committed, so the journal never outlives a run: WAL while the
 * process holds the database, checkpointed back into a single file on close.
 */

import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

/** Name of the database inside the index directory. */
export const INDEX_FILE = "index.sqlite";

/** Bumped whenever `SCHEMA` changes shape; `migrate` reads it back. */
export const SCHEMA_VERSION = 1;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
) WITHOUT ROWID;

-- One row per configured translation project. Everything below hangs off it,
-- so dropping a project drops its placement without touching the links: the
-- links are content-addressed and shared between projects by construction.
CREATE TABLE IF NOT EXISTS project (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  root          TEXT NOT NULL,
  target_root   TEXT NOT NULL,
  source_locale TEXT NOT NULL,
  scanned_at    TEXT NOT NULL
);

-- The content-addressed link, one row where the old format had one array
-- element. A target is current when its hash appears here under the current
-- source hash. Composite primary key makes re-linking idempotent.
CREATE TABLE IF NOT EXISTS translation (
  source_hash TEXT NOT NULL,
  locale      TEXT NOT NULL,
  target_hash TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (source_hash, locale, target_hash)
) WITHOUT ROWID;

-- The reverse lookup reindex needs: has this exact target already been linked
-- to some other source? Without the index that question is a table scan per
-- target file.
CREATE INDEX IF NOT EXISTS translation_by_target
  ON translation (locale, target_hash);

-- Where the sources are. 'dir' is stored beside 'rel' rather than derived at
-- query time so folder invalidation is an index range scan instead of a LIKE
-- over every row.
CREATE TABLE IF NOT EXISTS source_file (
  id          INTEGER PRIMARY KEY,
  project_id  INTEGER NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  rel         TEXT NOT NULL,
  dir         TEXT NOT NULL,
  kind        TEXT NOT NULL,
  bytes       INTEGER NOT NULL,
  mtime_ms    INTEGER NOT NULL,
  source_hash TEXT NOT NULL,
  seen_at     TEXT NOT NULL,
  UNIQUE (project_id, rel)
);
CREATE INDEX IF NOT EXISTS source_file_by_dir
  ON source_file (project_id, dir);
CREATE INDEX IF NOT EXISTS source_file_by_hash
  ON source_file (source_hash);

-- Where the translations are, and what the last scan concluded about each.
-- This is what the pre-run statistics table reads; it never has to touch the
-- filesystem to answer "how much work is queued for ru/product".
CREATE TABLE IF NOT EXISTS target_file (
  id          INTEGER PRIMARY KEY,
  project_id  INTEGER NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  rel         TEXT NOT NULL,
  dir         TEXT NOT NULL,
  locale      TEXT NOT NULL,
  present     INTEGER NOT NULL,
  bytes       INTEGER NOT NULL,
  source_hash TEXT NOT NULL,
  target_hash TEXT NOT NULL,
  status      TEXT NOT NULL,
  reasons     TEXT NOT NULL,
  seen_at     TEXT NOT NULL,
  UNIQUE (project_id, rel, locale)
);
CREATE INDEX IF NOT EXISTS target_file_by_dir
  ON target_file (project_id, locale, dir);
CREATE INDEX IF NOT EXISTS target_file_by_status
  ON target_file (project_id, status);

-- Content hashes keyed by identity-on-disk. A file whose size and mtime are
-- unchanged is not re-read; this is what makes a full rescan of both caches
-- cheap enough to run before every translate.
CREATE TABLE IF NOT EXISTS hash_cache (
  path     TEXT PRIMARY KEY,
  bytes    INTEGER NOT NULL,
  mtime_ms INTEGER NOT NULL,
  hash     TEXT NOT NULL
) WITHOUT ROWID;

-- Statistics. 'run' is the header a human reads, 'run_item' the per-file
-- detail an agent reads when a run has to be explained after the fact.
CREATE TABLE IF NOT EXISTS run (
  id            INTEGER PRIMARY KEY,
  mode          TEXT NOT NULL,
  model         TEXT,
  concurrency   INTEGER NOT NULL DEFAULT 1,
  started_at    TEXT NOT NULL,
  finished_at   TEXT,
  queued        INTEGER NOT NULL DEFAULT 0,
  translated    INTEGER NOT NULL DEFAULT 0,
  skipped       INTEGER NOT NULL DEFAULT 0,
  failed        INTEGER NOT NULL DEFAULT 0,
  requests      INTEGER NOT NULL DEFAULT 0,
  retries       INTEGER NOT NULL DEFAULT 0,
  source_chars  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS run_item (
  run_id  INTEGER NOT NULL REFERENCES run(id) ON DELETE CASCADE,
  project TEXT NOT NULL,
  locale  TEXT NOT NULL,
  rel     TEXT NOT NULL,
  route   TEXT NOT NULL,
  chars   INTEGER NOT NULL,
  ms      INTEGER NOT NULL,
  ok      INTEGER NOT NULL,
  detail  TEXT
);
CREATE INDEX IF NOT EXISTS run_item_by_run ON run_item (run_id);
`;

/**
 * Open (creating if needed) the index database for one cache directory.
 *
 * WAL is on for the lifetime of the process: a translate run commits after
 * every saved file and the rollback journal would fsync the whole database
 * each time. `closeIndex` folds the journal back in.
 */
export function openIndex(indexRoot: string): Database {
	mkdirSync(indexRoot, { recursive: true });
	const db = new Database(join(indexRoot, INDEX_FILE), { create: true });
	db.exec("PRAGMA journal_mode = WAL");
	db.exec("PRAGMA synchronous = NORMAL");
	db.exec("PRAGMA foreign_keys = ON");
	db.exec("PRAGMA busy_timeout = 5000");
	migrate(db);
	return db;
}

function migrate(db: Database): void {
	db.exec(SCHEMA);
	const row = db
		.query<{ value: string }, []>("SELECT value FROM meta WHERE key = 'schema'")
		.get();
	const found = row ? Number(row.value) : 0;
	if (found > SCHEMA_VERSION) {
		throw new Error(
			`Translation index is schema v${found}, this build understands v${SCHEMA_VERSION}`,
		);
	}
	db.query("INSERT OR REPLACE INTO meta (key, value) VALUES ('schema', ?)").run(
		String(SCHEMA_VERSION),
	);
}

/**
 * Leave one file on disk, never a `-wal`/`-shm` pair. The index is committed,
 * and a sidecar journal that outlives the process is both a dirty working
 * tree and a database another checkout cannot read.
 */
export function closeIndex(db: Database, compact = false): void {
	try {
		db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
		db.exec("PRAGMA journal_mode = DELETE");
		// Small database, and only after a run that wrote: keeps the committed
		// file from growing free pages that show up as diff noise forever.
		if (compact) db.exec("VACUUM");
	} finally {
		db.close();
	}
}
