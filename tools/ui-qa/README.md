# ui-qa

Design-system QA against the interface the browser actually rendered — not a
screenshot of it, and not the code behind it.

Chromium is the source of truth for geometry, computed style, typography and
colour. A deterministic rule set checks those facts against the design system,
a baseline keeps the existing debt out of the way, and anything that needs
interpretation is left to a human or to an AI pass whose output is a reviewable
rule rather than a verdict inside the run.

The concept and the reasoning behind it: `manage/tz/ui-testing.md`.

## Run it

```sh
# any URL, including a file:// page — no stack needed
bun run tools/ui-qa/src/cli.ts --url https://example.com

# the fixture, which has one of every planted defect
bun run tools/ui-qa/src/cli.ts --url "file://$PWD/tools/ui-qa/fixture/demo.html"

# projections in the running console, signed in the way a person is
bun run --env-file=../confs/dev/converged.env tools/ui-qa/src/cli.ts \
  --base-url http://localhost:3000 \
  --role owner \
  --target requests=/console/requests \
  --target leads=/console/crm/leads

# a target list in a file, and a baseline so CI only sees new debt
bun run tools/ui-qa/src/cli.ts --targets targets.json \
  --baseline tools/ui-qa/baseline.json
bun run tools/ui-qa/src/cli.ts --targets targets.json \
  --baseline tools/ui-qa/baseline.json --update-baseline
```

`--rules` lists the rule ids. Exit code is `1` when a run produces **new**
errors or a target could not be measured; new warnings and known debt print but
do not fail a build.

| Flag | What it does |
| --- | --- |
| `--url`, `--target name=/path`, `--targets file.json` | what to measure, repeatable |
| `--role` | sign in through `tools/verify` before visiting the targets |
| `--base-url` | where `--target` paths resolve (default `http://localhost:3000`) |
| `--viewports` | `390x844@2,768x1024,1440x900` (default), `@` is the pixel ratio |
| `--baseline`, `--update-baseline` | compare against / rewrite the accepted debt |
| `--config` | rule severities, tolerances, accepted differences |
| `--json`, `--snapshot-out` | findings / the raw measured model |
| `--settle` | quiet period after `document.fonts.ready`, ms |
| `--headed` | watch it happen |

## How it decides what is wrong

The allowed values are **probed out of the running document**, not written in a
config: `tokens.css` states the whole system as `--hw-*` custom properties, so
`spec.ts` assigns each one to a real property and reads back what the engine
computed. `width: var(--hw-space-3)` → `12px`. There is no second source of
truth to drift.

The elements it measures are **our own components only**: the walk enters
`[data-slot]` subtrees and skips vendor markup (`svg`, `canvas`,
`model-viewer`, maps, anything marked `data-qa-ignore`). Linting a whole console
page unfiltered is how a tool like this earns its first hundred false positives.

`data-slot` + `data-variant` is also what makes consistency checkable without a
model: two elements with the same slot and variant are the same component *by
construction*, so a difference between them is a defect rather than a judgement
call.

## Rules

| Rule | Default | Checks |
| --- | --- | --- |
| `layout/overflow` | error | content clipped inside a box that does not scroll |
| `layout/viewport-overflow` | error | an element reaches past the right edge |
| `a11y/touch-target` | warning | interactive element below 24×24 |
| `spacing/grid-conformance` | warning | padding/margin/gap off the base unit |
| `spacing/scale-conformance` | info | …and off the spacing tokens entirely |
| `radius/scale-conformance` | warning | border-radius outside the radius tokens |
| `type/scale-conformance` | warning | font-size outside the type tokens |
| `type/weight-conformance` | warning | undeclared font-weight |
| `type/family-conformance` | warning | unapproved font family |
| `color/palette-conformance` | warning | colour off palette (weighted sRGB distance) |
| `sibling/padding-consistency` | warning | one sibling of a component group differs |
| `sibling/height-consistency` | info | one row of a group is a different height |
| `slot/cross-consistency` | warning | one component has several looks |

Every rule is a pure function from a snapshot to findings, so the whole set is
tested from literal data with no browser (`bun test tools/ui-qa`). A rule that
cannot be tested that way is a rule that is about to start flaking.

## Config

```json
{
	"tolerancePx": 0.5,
	"colorTolerance": 10,
	"minTouchTarget": 24,
	"rules": {
		"spacing/scale-conformance": { "enabled": false },
		"layout/overflow": { "severity": "error" }
	},
	"accepted": [
		{
			"rule": "sibling/padding-consistency",
			"slot": "card",
			"reason": "list density and preview density are deliberate"
		}
	]
}
```

`accepted` is where the semantic layer writes. A model may propose entries by
looking at a run's new findings; a person reviews them once, and from then on
the decision is a rule the next run applies deterministically instead of being
re-reasoned.

## Baseline

`--baseline` splits findings into new, known and gone. Identity is
`rule|target|viewport|path|prop` and deliberately excludes the measured value,
so changing a wrong `13px` to `15px` stays the same unresolved finding instead
of surfacing as a regression. Element paths are slot chains
(`/@panel/@card:1/@title`), not CSS selectors, so they survive a restyle.

The target name is part of that identity, so **name targets explicitly** when a
baseline is involved: `--target requests=/console/requests` keeps its name,
while a bare `--url` takes the last segment of the path and a rename invalidates
every finding that came from it. Viewports are part of it too — `--viewports`
has to stay the same between the run that wrote the baseline and the runs
compared against it.

## As a library

```ts
import { collect, runRules } from "ui-qa";
```

A `verify` story can snapshot mid-journey and assert on the measured model
directly — the useful half of this tool is the machine-readable UI layer, not
the CLI around it.

## Fixture

`fixture/demo.html` plants one of every defect: off-grid padding, a non-token
radius, a hand-picked font size/weight/family, an off-palette red, an 18px
button, clipped content, a 2200px-wide card, one odd sibling in a group and a
badge with three looks. Running the CLI against it exercises the whole pipeline
without the stack, and is the fastest way to see whether a change to a rule did
what it meant to.
