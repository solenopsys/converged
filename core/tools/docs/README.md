# docs-builder

Assembles documentation that lives next to the code it describes, and emits it
in five shapes: the production site, GitHub READMEs, static HTML, PDF, and the
ecosystem page built from the module tree. Sources are also handed to
`translation-control`.

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
<owner>/docs/<lang>/<section>/<id>.md       the articles
<owner>/docs/<lang>/<section>/index.json    optional: order and titles
<owner>/docs/<lang>/<section>/meta.json     optional: chapter, group heading
```

The whole project tree from `docs.config.json` is scanned — module, library,
tool, native app, repository root. `node_modules`, `dist`, `build` and the rest
of the noise are skipped, and a `docs` folder without `<lang>/<section>` is not
ours: third-party checkouts are full of `docs` directories.

Language sits before section on purpose: in that layout a `docs` folder is a
valid `translation-control` root, and that tool compares `<root>/<locale>/<…>`
trees. In practice an owner keeps only `en`; every other language lives in the
translation cache.

`index.json` is the same format `struct-ms` serves:

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

`mf-docs` reads both shapes. Two owners claiming the same `slug` in one section
is a build error.

With ~135 owners a section flattened into 135 groups is a dump, not a
structure, so owners are grouped into **chapters** first. A module's chapter
defaults to its domain — `ms-notify` is in `communications` because it sits
there — and `meta.json` overrides it. Chapter titles and order are editorial
and live in `docs.config.json`; a chapter nobody titled shows up under its own
id rather than disappearing.

## Running

```bash
bun run docs:list          # what was found
bun run docs:site          # struct-ms + markdown-ms
bun run docs:ecosystem     # the ecosystem landing, from the module tree
bun run docs:readme        # build/docs/readme/<lang>/<section>.md
bun run docs:html          # build/docs/html/<lang>/<section>.html
bun run docs:pdf           # build/docs/pdf/<lang>/<section>.pdf
bun run docs:translations  # config for translation-control
bun run docs               # everything
```

Flags: `--config <path>`, `--section <name>`, `--lang <code>`, `--dry-run`,
`--no-prune`.

## Outputs

| Target | Where | What it is |
| --- | --- | --- |
| `site` | `data/club/struct-ms/struct/data`, `data/club/markdown-ms/markdown/data` | generated site data: merged section indexes plus every nested article and index |
| `ecosystem` | `data/club/struct-ms/struct/data/<lang>/landings/ecosystem` | the ecosystem landing |
| `readme` | `build/docs/readme` | one article per section, with a table of contents |
| `html` | `build/docs/html` | preact SSR, side menu, inline styles |
| `pdf` | `build/docs/pdf` | the same pages, printed |
| `translations` | `build/docs/translation-control.json` | projects for `translation-control` |

HTML and PDF render through the same `MarkdownRenderer` the site uses, and
styles are built from `uno.mf.config.ts` and `front-core` tokens, so a static
build cannot drift from the product. PDF is printed by puppeteer when it is
installed, otherwise by any Chrome or Chromium found (`DOCS_CHROME` overrides).

## The ecosystem page

`ecosystem` builds the module registry landing. Structure comes from the source
tree and nowhere else:

```
modules/microservices/<domain>/ms-<name>
modules/microfrontends/<domain>/mf-<name>
modules/workflows/wf-<name>
modules/solutions/solutions/<id>.json      (aggregate solutions.json is the fallback)
```

A module is on the page because its directory exists; in a domain because it
sits in that folder; in a solution because the solution names it. A module's
purpose is read from its `README.md` — the first paragraph under `## Purpose`
(`## UI Purpose` for microfrontends) and the paragraph under the ownership
boundary heading. Counters are computed, not written.

Wording is the only hand-authored part, and it lives where the rest of the docs
live: `<project>/docs/<lang>/ecosystem/landing.json`. One file per language
holding block headings, kind labels, and domain and solution names. Several
projects merge key by key, so a product layer can rename a domain without
restating the file.

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
output is cleaned: `struct-ms` holds hand-maintained content beside the
generated one (`landing/`, `functions/`), and no rule over names separates
them. `--no-prune` turns the cleanup off.

## Translations

`docs:translations` builds a config in which each discovered `docs` root is one
`translation-control` project. Then:

```bash
cd ../translation
bun run src/index.ts --check --config ../../../../build/docs/translation-control.json
```

Drift is tracked in the sources, not in the generated stores: an edit inside
`data/` would be overwritten by the next build anyway. Roots without the
`sourceLocale` language are left out — there is nothing to compare them to.

### The translation cache

`converged/docs-cache` is a submodule
([converged_docs](https://github.com/solenopsys/converged_docs)) holding every
language but the source one:

```
<lang>/<section>/[<owner>/]<slug>.md    translated articles
<lang>/<section>/[<owner>/]index.json   translated index
<lang>/ecosystem/landing.json           translated landing copy
```

It is read exactly like an authored `docs` folder — a translated section
becomes a contribution under the same owner, and the emitters cannot tell the
difference. It is laid out flat while a section has one contributor and grows
an `<owner>` level when it has several, which is the shape `emitSite` already
writes. Cache contributions never appear in the discovered roots: a root is
somewhere a human authors, and nobody authors here.

Configured as `cache` in `docs.config.json`. A cache that is not checked out
means "no translations", never an error — it is a submodule and may be absent.

Separate repository so machine-produced text does not churn the platform's
history; in version control rather than in `build/` because a translation costs
real work and must survive a clean checkout.

`core/tools/translation` compares each authored root against the matching cache
root. Its generated config uses `targetRoot` for `docs-cache`, while state and
reports stay in `build/docs/translation` and the durable translation ledger is
stored in `docs-cache/.translation/`.

`core/tools/translation` carries the field a cache needs:
**`translatedFromHash`**, the hash of the English text a translation was made
from. Staleness is `sourceHash !== translatedFromHash`, written by `--record`
when a translation is produced rather than by a scan, so it survives any number
of scans. Markdown is compared by heading outline instead of falling through to
a bare hash. See [`../translation/README.md`](../translation/README.md).

### Root index and coverage

*Not built yet.*

`docs-cache/index.json` is the one place that answers what documentation
exists: sections, their chapters, the owners in each chapter, and the articles
each owner ships. It is generated by walking the tree and joining it with the
module registry, so it needs no maintenance.

It carries coverage with it — every registry entry either has an article or is
explicitly exempt — and that is what makes the documentation *live* rather than
merely *distributed*: drift becomes visible instead of being spread across 135
folders. Staleness is the second half, and git already answers it: a `docs/`
folder whose last commit is older than its `src/` is a candidate.
