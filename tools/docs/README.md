# docs-builder

Assembles documentation and product-owned content, then emits the runtime
stores, GitHub READMEs, static HTML, PDF, and the ecosystem page built from the
module tree. Sources are also handed to `translation-control`.

Generation runs **one way**: from sources into stores. Everything under `data/`
and `build/` is an artefact — an edit there survives until the next build and
no longer.

## The idea

Documentation belongs to the thing it documents. A microservice explains
itself; so does a native app, a frontend library, a tool, a solution. There is
no central directory where someone remembers to describe modules other people
wrote, because that directory always rots.

Three rules follow from that:

1. **A doc is authored beside its code.** Any directory can own documentation
   by holding a `docs` folder.
2. **Position is derived, not declared.** A module lands in a chapter because
   of where it sits in the tree, the same way it lands on the ecosystem page.
   `meta.json` exists only to override.
3. **Sources are English.** Every other language is produced by translation and
   kept in a cache, so an author writes one file and never sees a locale.

## Sources

```
<owner>/docs/<section>/<id>.md       the articles
<owner>/docs/<section>/index.json    optional: order and titles
<owner>/docs/<section>/meta.json     optional: chapter, group heading
```

The whole project tree from `docs.config.json` is scanned — module, library,
tool, native app, repository root. `node_modules`, `dist`, `build` and the rest
of the noise are skipped, and a `docs` folder without `<section>/index.json` is not
ours: third-party checkouts are full of `docs` directories.

Authored documentation is always English, so source trees have no redundant
language directory. Every locale, including the synchronized English baseline,
lives in the project content cache.

Closed product content uses one consolidated source tree:

```
club/content/struct/en/<path>.json       authored struct content
club/content/markdown/en/<path>.md       authored Markdown content
club/content/static/<path>        authored gallery assets
```

The `site` target preserves those store boundaries and copies `static/`
verbatim into `rp-galery`. Generated documentation and the
ecosystem landing still come from their distributed sources, so they are not
duplicated under `club/content`.

`index.json` is the same format `rp-struct` serves:

```json
[
  { "slug": "overview", "title": "What Converged does", "order": 0 },
  { "slug": "arch",     "title": "Architecture",        "order": 1 }
]
```

`id` may be omitted — the file is then looked up as `<slug>.md`.

## Sections, chapters and merging

A section (`product`, `platform`, `ecosystem`, …) is a chapter of the site, and
several owners contribute to one.

- One owner — a flat index, articles ordered by `order`.
- Several — a compound index: `{ "compound": true, "groups": [...] }`. Each
  owner's block stays intact and keeps its order. The heading comes from
  `meta.json` (`group`), defaulting to the owner's name.

`sf-docs` reads both shapes. Two owners claiming the same `slug` in one section
is a build error.

With ~135 owners a section flattened into 135 groups is a dump, not a
structure, so owners are grouped into **chapters** first. A module's chapter
defaults to its domain — `rp-notify` is in `communications` because it sits
there — and `meta.json` overrides it. Chapter titles and order are editorial
and live in `docs.config.json`; a chapter nobody titled shows up under its own
id rather than disappearing.

## Running

```bash
bun run build:doc       # synchronize caches and build all runtime content
bun run build:doc -t    # translate missing/stale files, validate, then rebuild
```

`-t` uses the OpenAI Responses API and requires both `OPENAI_API_KEY` and
`DOCS_TRANSLATION_MODEL`. Internal targets and diagnostic flags remain available
directly on `src/cli.ts`, but are not separate package commands.

## Outputs

| Target | Where | What it is |
| --- | --- | --- |
| `site` | `data/club/rp-struct/struct/data`, `data/club/rp-markdown/markdown/data`, `data/club/rp-galery/static` | product content plus generated documentation and static assets |
| `ecosystem` | `data/club/rp-struct/struct/data/<lang>/landings/ecosystem` | the ecosystem landing |
| `readme` | `build/docs/readme` | one article per section, with a table of contents |
| `html` | `build/docs/html` | preact SSR, side menu, inline styles |
| `pdf` | `build/docs/pdf` | the same pages, printed |
| `translations` | `build/docs/translation-control.json` | projects for `translation-control` |

HTML and PDF render through the same `MarkdownRenderer` the site uses, and
styles are built from `uno.sf.config.ts` and `front-core` tokens, so a static
build cannot drift from the product. PDF is printed by puppeteer when it is
installed, otherwise by any Chrome or Chromium found (`DOCS_CHROME` overrides).

## The ecosystem page

`ecosystem` builds the module registry landing. Structure comes from the source
tree and nowhere else:

```
modules/repositories/<domain>/rp-<name>
modules/surfaces/<domain>/sf-<name>
modules/workflows/wf-<name>
modules/solutions/solutions/<id>.json      (aggregate solutions.json is the fallback)
```

A module is on the page because its directory exists; in a domain because it
sits in that folder; in a solution because the solution names it. A module's
purpose is read from its `README.md` — the first paragraph under `## Purpose`
(`## UI Purpose` for surfaces) and the paragraph under the ownership
boundary heading. Counters are computed, not written.

Wording is the only hand-authored part. Public copy lives at
`converged/docs/ecosystem/landing.json`; closed product copy lives at
`club/content/struct/en/ecosystem/landing.json`. They merge key by key, so the product
layer can rename a domain without restating the public file.

A domain or solution nobody labelled appears under its own id. A new module is
on the page immediately, even before anyone names its domain.

## README and docs are different documents

A `README.md` is the engineering document: purpose, ownership boundary, how to
run it. It stays English and is not translated. `docs/` carries the product
article: what the thing does for a reader, translated, published to the site.

The registry reads the README for its one-line purpose. A module with a README
and no `docs/` appears in the registry without an article — and coverage
reports it. Merging the two would put English engineering prose on a product
site.

## Pruning

Every run writes `.docs-build.json`, a record of what it produced. On the next
run anything that dropped out of that record is deleted, and directories the
deletion emptied are removed up to the output root. This is why only our own
output is cleaned. The manifest is the ownership boundary that prevents one
target from pruning files emitted by another. `--no-prune` turns cleanup off.

## Translations

`build:doc` builds a config in which each discovered `docs` root and
the consolidated `club/content` tree are separate `translation-control`
projects. Then:

```bash
cd ../translation
bun run src/index.ts --check --config ../../../../build/docs/translation-control.json
```

Drift is tracked in the sources, not in the generated stores: an edit inside
`data/` would be overwritten by the next build anyway.

### The translation cache

There are two caches because the public platform and closed product have
different ownership boundaries:

- `converged/content/docs-cache` is the public documentation cache submodule.
- `club/content/docs-cache` contains product documentation and content locales.

Both hold a synchronized English baseline and every target locale. Their layouts are:

```
<lang>/<section>/[<owner>/]<slug>.md    translated articles
<lang>/<section>/[<owner>/]index.json   translated index
<lang>/ecosystem/landing.json           translated landing copy
struct/<lang>/<path>.json               closed struct content
markdown/<lang>/<path>.md               closed Markdown content
```

It is read exactly like an authored `docs` folder — a translated section
becomes a contribution under the same owner, and the emitters cannot tell the
difference. It is laid out flat while a section has one contributor and grows
an `<owner>` level when it has several, which is the shape `emitSite` already
writes. Cache contributions never appear in the discovered roots: a root is
somewhere a human authors, and nobody authors here.

Each project cache is discovered at `content/docs-cache`; the product cache is
also the translation target for `content/struct` and `content/markdown`. An
absent cache means "no translations", never an error.

`core/tools/translation` compares each authored root against the matching cache.
Reports stay in `build/docs/translation`; durable freshness links live as
individual `content/docs-cache/.translation/<sourceHash>.json` nodes.
Each locale points to the hash of its existing target file. A changed source
hash invalidates all locales, while a missing or hash-mismatched target
invalidates only that locale. Deleting a bad file schedules it for translation.
See [`../translation/README.md`](../translation/README.md).

### Root index and coverage

`content/index.json` is the one place in each project that answers what
documentation exists: every owning `docs` path, its sections and the articles
each section ships. It is generated by walking the tree, so it needs no
maintenance.

It carries coverage with it — every registry entry either has an article or is
explicitly exempt — and that is what makes the documentation *live* rather than
merely *distributed*: drift becomes visible instead of being spread across 135
folders. Staleness is the second half, and git already answers it: a `docs/`
folder whose last commit is older than its `src/` is a candidate.
