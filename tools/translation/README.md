# translation

Tracks translation files: what is missing, what drifted, what was never
translated, and what has gone stale since it was. The docs builder can also use
the report as a queue and translate the affected files through the OpenAI
Responses API.

Platform infrastructure, so it lives here rather than in a product layer. A
product keeps only its own configuration and state; club's is in
[`club/tools/translation`](../../../../club/tools/translation).

## Content-addressed index

Every source file is hashed. Its atomic index node is
`.translation/<sourceHash>.json` and contains the target hash for each
translated locale:

```json
{
  "version": 1,
  "sourceHash": "...",
  "translations": {
    "de": ["target-hash-a", "target-hash-b"]
  }
}
```

Source and target paths have the same relative structure, so no file lookup or
content copy is needed. A target is current when its file exists and its hash is
in the current source-hash node's locale list. Changing a source hash
invalidates every locale; deleting or changing one target invalidates that
locale. Each successful translation writes its target and source-hash node
atomically before the next request.

## Running

```bash
bun run src/cli.ts --config <path>            # scan, write state and report
bun run src/cli.ts --check --config <path>    # read-only, exit 1 on issues
bun run src/cli.ts --reindex --config <path>  # rebuild links from cache files
bun run src/cli.ts --translate --config <path> # translate missing hash links
```

`--project <name>` limits a run, and repeats.

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
	"translationIndex": "./.translation"
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
| `store.ts` | atomic `sourceHash` to locale/`targetHash` links |
| `status.ts` | evidence → one status |
| `scan.ts` | one project, every file, every locale |
| `report.ts` | the machine-readable output |
| `config.ts` | config and state loading |
| `cli.ts` | argument parsing and the run |

```bash
bun test
```
