# translation

Tracks translation files: what is missing, what drifted, what was never
translated, and what has gone stale since it was. It does not call a
translation API — it decides *what* needs translating and leaves *how* to
whoever runs it.

Platform infrastructure, so it lives here rather than in a product layer. A
product keeps only its own configuration and state; club's is in
[`club/tools/translation`](../../../../club/tools/translation).

## Two records, two questions

The distinction the tool is built around:

| | Question | Written by | Lifetime |
| --- | --- | --- | --- |
| **state** | did the source change since I last looked? | every scan | one scan |
| **ledger** | did the source change since this was translated? | `--record` only | until retranslated |

State alone cannot drive a translation queue, and the reason is not obvious:
the scan that reports `source-changed` is also the scan that writes the new
hash into its own baseline. Run it twice and the finding is gone, though
nobody translated anything in between. The signal is consumed by observing it.

The ledger records what a translation was actually made from — its
`translatedFromHash`. Staleness is `sourceHash !== translatedFromHash`, and no
number of scans can clear it. Only translating and recording can:

```
scan            UNRECORDED  notify.md → ru
record
scan            (clean)
                              ← english source edited here
scan            STALE       notify.md → ru
scan            STALE       notify.md → ru
scan            STALE       notify.md → ru
```

A recorded translation that no longer matches the file on disk falls back to
`unrecorded` rather than `ok`: the entry describes text that is no longer
there, so it says nothing about what is.

## Running

```bash
bun run src/cli.ts --config <path>            # scan, write state and report
bun run src/cli.ts --check --config <path>    # read-only, exit 1 on issues
bun run src/cli.ts --record --config <path>   # the translations on disk are current
bun run src/cli.ts --prune --config <path>    # drop ledger entries with no source
```

`--project <name>` limits a run, and repeats. `--check` and `--record` are
mutually exclusive: one refuses to write, the other exists to.

`--record` is the verb a translation pass ends with. A scan cannot infer it —
only whoever produced the translations knows they correspond to the sources now
on disk. Adopting an existing tree is the same command run once.

Recording does not paper over anything: structure drift and untranslated text
are recomputed from the files on every scan, so a file recorded while still in
English keeps reporting `untranslated-text`.

## Statuses

Ordered most specific first — a file can be several of these at once, and the
status names the one to act on while `reasons` keeps the rest.

| Status | Meaning |
| --- | --- |
| `invalid-json` | the target does not parse |
| `missing` | no target file |
| `structure-drift` | keys or headings differ from the source |
| `untranslated-text` | strings identical to the source, or locale metadata still naming it |
| `stale` | translated, then the source changed |
| `unrecorded` | a target exists but the ledger does not describe it |
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
	"targetRoot": "../../../converged/docs-cache",
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
    "ledgerFile": "./ledger.json"
  }]
}
```

Paths are relative to the config. `routes` gets a second pass of its own: a
landing config that drifted breaks a whole page rather than one string, and
that deserves to be visible without reading the per-file list.

`root` owns the source locale. `targetRoot` is optional and defaults to
`root`; set it when translations live in a separate cache repository. Source
paths remain the keys in state and ledger files, so moving translated files to
a cache does not change their staleness history.

The report is JSON because its consumer is usually not a person — a translation
agent reads it to find its work, so it carries the affected paths and the
offending strings rather than a rendered summary.

## Layout

| File | Holds |
| --- | --- |
| `types.ts` | every shape, and the state/ledger distinction |
| `fs.ts` | walking, selecting, hashing, atomic writes |
| `json-tree.ts` | JSON reduced to paths and kinds |
| `markdown.ts` | markdown reduced to a heading outline |
| `heuristics.ts` | which strings a human was supposed to translate |
| `compare.ts` | source against target, one `TreeDiff` either way |
| `ledger.ts` | `translatedFromHash` bookkeeping |
| `status.ts` | evidence → one status |
| `scan.ts` | one project, every file, every locale |
| `report.ts` | the machine-readable output |
| `config.ts` | config and state loading |
| `cli.ts` | argument parsing and the run |

```bash
bun test
```
