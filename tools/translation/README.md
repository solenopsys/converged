# translation

Tracks translation files: what is missing, what drifted, what was never
translated, and what has gone stale since it was. The docs builder can also use
the report as a queue and translate the affected files through the OpenAI
Responses API.

Platform infrastructure, so it lives here rather than in a product layer. A
product keeps only its own configuration and state; club's is in
[`club/tools/translation`](../../../../club/tools/translation).

## The index

One SQLite database per content cache, at `.index/index.sqlite`, opened with
`bun:sqlite`. It replaced a directory of `<sourceHash>.json` nodes, which
carried the links correctly but could not answer anything else.

| Table | Holds |
| --- | --- |
| `translation` | `(source_hash, locale, target_hash)` — the content-addressed link |
| `project` | one row per configured project |
| `source_file` | every source, with its folder, kind, size and hash |
| `target_file` | every locale target, with its folder, hash and last verdict |
| `hash_cache` | `path → hash`, keyed on size and mtime |
| `run`, `run_item` | what each translate run queued, sent, saved and skipped |

Source and target paths have the same relative structure, so no file lookup or
content copy is needed. A target is current when its file exists and
`(source_hash, locale, target_hash)` is present. Changing a source hash
invalidates every locale; deleting or changing one target invalidates that
locale. Each successful translation writes its target and its link before the
next request.

`source_file` and `target_file` are the half the JSON nodes never had. A hash
has no location, so "retranslate `product/`" had no query to run; storing the
folder beside the path gives it one, and gives the volume table its per-folder
breakdown for free. They are also the scanner's own memory of the previous
run: without it every target came back `untracked` because the state file the
scanner read was never written.

The database is committed. Its `-wal`/`-shm` journal is not: the process holds
WAL for speed and checkpoints it back into the single file on exit.

## Running

```bash
bun run src/cli.ts --config <path>             # scan and report
bun run src/cli.ts --check --config <path>     # read-only, exit 1 on issues
bun run src/cli.ts --stats --config <path>     # volume table + run history
bun run src/cli.ts --reindex --config <path>   # rebuild links from cache files
bun run src/cli.ts --translate --config <path> # translate missing hash links
bun run src/cli.ts --invalidate product --locale ru --config <path>
```

`--project <name>` limits a run, and repeats. A filtered `--reindex` adopts
what it scanned and prunes nothing, because one index serves about a hundred
module projects and the other ninety-nine were not looked at.

`--no-cache` hashes every file instead of trusting size and mtime.

## Volume, before anything is spent

A translate run costs money and tens of minutes. `--stats` — and the first
thing `--translate` prints — is the same queue the translator is about to
consume, counted three ways:

```
  project        files  targets   ok  queued  source  ~req
  converged         19      114   93       3  3.9 KB     1

  locale  targets  ok  queued  file  string  source  ~req
  ru           19  13       3     3       0  3.9 KB     1

  folder     project    queued  source
  ecosystem  converged       3  3.9 KB

  status             targets
  ok                     787
  untranslated-text      755

  total: 3 of 1542 targets queued (787 ok), 3.9 KB of source, ~1 requests
```

The queue is built once, in `queue.ts`, and both the table and the run read
it, so the table cannot promise a number the run then disagrees with. The
status table is the other half of the picture: a target can be linked — and so
never queued — and still be structurally wrong.

Making that table cheap is what `hash_cache` is for. A full rescan of both
caches hashes about 3300 files; on the second run essentially all of them are
cache hits and the whole pass takes under half a second.

## Invalidating a folder

```bash
bun run src/cli.ts --config <path> --project converged --invalidate ecosystem --locale ru
```

Drops the links of every source under that folder and its subfolders, so the
next `--translate` redoes exactly those files. The unit is the source hash
rather than the path: two files with identical content share one link, and
dropping it for one necessarily drops it for the other. `--project` and
`--locale` narrow it; omit both and it applies everywhere.

## Concurrency

Batches run several at a time. The work is network-bound — one HTTPS request
the model spends tens of seconds answering — so this is a bounded async pool,
not worker threads: there is no CPU to spread. Six locales of one project used
to run strictly one after another even though the requests are independent.

`DOCS_TRANSLATION_CONCURRENCY` sets the limit (default 4, capped at 32);
`--concurrency <n>` overrides it for one run. Rate limits and transport
failures back off exponentially with jitter, which matters here because a 429
arrives for every in-flight request at once.

Every write still happens on the single thread that owns the SQLite handle,
after the network and in input order, so nothing about the store had to become
thread-safe and a run stays reproducible.

## Migrating from `.translation`

```bash
bun run scripts/migrate-index.ts <docs-cache>...            # write the database
bun run scripts/migrate-index.ts --verify <docs-cache>...   # prove nothing was lost
```

Additive by design: it reads the old directory, writes `.index/index.sqlite`,
copies `control.json` next to it and touches nothing else. Deleting
`.translation` is a separate decision, made after `--verify` reports zero
missing links.

## Statuses

Ordered most specific first — a file can be several of these at once, and the
status names the one to act on while `reasons` keeps the rest.

| Status | Meaning |
| --- | --- |
| `invalid-json` | the target does not parse |
| `missing` | no target file |
| `structure-drift` | keys or headings differ from the source |
| `untranslated-text` | strings identical to the source, or locale metadata still naming it |
| `unrecorded` | the current source hash has no matching locale/target-hash link |
| `source-changed` | source differs from the last scan's baseline |
| `target-modified` | target differs from the last scan's baseline |
| `untracked` | the previous scan did not know this target |

## What gets compared

**JSON** is compared as a tree of paths and node kinds, never values —
translated text differs everywhere by design, so comparing values would report
every correct file. Paths are JSON-Pointer-escaped, so a key containing a
slash cannot forge another path.

**Markdown** is compared by heading outline: levels and their order, never
heading text. Fenced code is excluded from both passes, because code is meant
to survive translation verbatim.

Text is then checked separately for strings the target left identical to the
source. That check is filtered by [`heuristics.ts`](src/heuristics.ts): ids,
icon names, URLs, file paths and numbers are not translation misses, while
short values under keys like `title` or `nav` are checked anyway because they
are exactly what gets forgotten. `sameTextScriptByLocale` spares loanwords a
locale legitimately keeps verbatim.

## Configuration

```json
{
  "projects": [{
	"name": "club-struct-ms",
	"root": "../../../data/club/struct-ms/struct/data",
	"sourcePath": "en",
	"targetRoot": "../../../converged/content/docs-cache",
    "sourceLocale": "en",
    "targetLocales": ["de", "ru"],
    "include": ["landings"],
    "exclude": [],
    "routes": [{ "path": "/club", "config": "landings/club/index.json" }],
    "validation": {
      "minUnchangedStringLength": 24,
      "ignoreStringPaths": [],
      "localeKeys": ["lang"],
      "sameTextScriptByLocale": { "ru": "cyrillic" }
    },
    "stateFile": "./state.json",
	"reportFile": "./report.json",
	"translationIndex": "./.index"
  }]
}
```

Paths are relative to the config. `routes` gets a second pass of its own: a
landing config that drifted breaks a whole page rather than one string, and
that deserves to be visible without reading the per-file list.

`sourcePath` names the source directory below `root` and defaults to
`sourceLocale`. Set it to `.` when the source tree has no locale directory,
as with `docs/<section>` English sources. `targetRoot` is optional and defaults
to `root`; set it when translations live in a separate cache repository. Source
paths remain the keys in scan state, while freshness comes from source hashes.

The report is JSON because its consumer is usually not a person — a translation
agent reads it to find its work, so it carries the affected paths and the
offending strings rather than a rendered summary.

## Layout

| File | Holds |
| --- | --- |
| `types.ts` | configuration, snapshots and reports |
| `fs.ts` | walking, selecting, hashing, atomic writes |
| `json-tree.ts` | JSON reduced to paths and kinds |
| `markdown.ts` | markdown reduced to a heading outline |
| `heuristics.ts` | which strings a human was supposed to translate |
| `compare.ts` | source against target, one `TreeDiff` either way |
| `db.ts` | the SQLite schema, and opening/closing it without a stray journal |
| `store.ts` | `sourceHash` to locale/`targetHash` links |
| `placement.ts` | where files are; folder invalidation; the previous scan |
| `hashcache.ts` | content hashes memoized on size and mtime |
| `queue.ts` | what a translate run would do, decided once |
| `pool.ts` | bounded concurrency, retry and backoff |
| `stats.ts` | the volume table and the run ledger |
| `status.ts` | evidence → one status |
| `scan.ts` | one project, every file, every locale |
| `report.ts` | the machine-readable output |
| `config.ts` | config and state loading |
| `cli.ts` | argument parsing and the run |

```bash
bun test
```
