/**
 * `ui-qa` — lint the interface the browser actually rendered.
 *
 *   bun run tools/ui-qa/src/cli.ts --url https://example.com
 *   bun run tools/ui-qa/src/cli.ts --target requests=/console/requests --role owner
 *   bun run tools/ui-qa/src/cli.ts --targets targets.json --update-baseline
 *
 * The exit code answers one question — did this change make the interface
 * worse? — so it counts new errors only. Warnings and known debt are printed
 * and do not fail a build: a gate that fires on the whole backlog is a gate
 * that gets removed.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { compare, readBaseline, writeBaseline } from "./baseline";
import { formatReport, summarize } from "./report";
import { RULE_IDS, runCrossRules, runRules } from "./rules";
import { collect, DEFAULT_VIEWPORTS, type Target } from "./run";
import type { Viewport } from "./snapshot";
import { type Config, DEFAULT_CONFIG, type Violation } from "./violation";

function parseViewports(raw: string | undefined): Viewport[] {
	if (!raw) return DEFAULT_VIEWPORTS;
	return raw.split(",").map((entry) => {
		const match = entry.trim().match(/^(\d+)(?:x(\d+))?(?:@([\d.]+))?$/);
		if (!match) {
			throw new Error(
				`[ui-qa] bad viewport "${entry}", expected 390 or 390x844 or 390x844@2`,
			);
		}
		const width = Number(match[1]);
		return {
			name: `${width}px`,
			width,
			height: match[2] ? Number(match[2]) : 900,
			dpr: match[3] ? Number(match[3]) : 1,
		};
	});
}

/** `--target name=/path` or `--target /path`, repeatable. */
function parseTargets(
	entries: string[],
	urls: string[],
	role: string | undefined,
	file: string | undefined,
): Target[] {
	const targets: Target[] = [];
	if (file) {
		const parsed = JSON.parse(readFileSync(resolve(file), "utf8"));
		if (!Array.isArray(parsed)) {
			throw new Error(`[ui-qa] ${file} must contain an array of targets`);
		}
		for (const entry of parsed as Target[]) {
			targets.push({ ...entry, role: entry.role ?? role });
		}
	}
	for (const entry of entries) {
		const split = entry.indexOf("=");
		const name = split > 0 ? entry.slice(0, split) : entry;
		const path = split > 0 ? entry.slice(split + 1) : entry;
		targets.push({ name, path, role });
	}
	for (const url of urls) {
		// A target name ends up on every line of the report, so it is the last
		// segment of the URL, not the URL.
		const parsed = new URL(url);
		const last = parsed.pathname.split("/").filter(Boolean).pop();
		targets.push({ name: last ?? parsed.host ?? url, url });
	}
	return targets;
}

function loadConfig(path: string | undefined): Config {
	if (!path) return DEFAULT_CONFIG;
	const resolved = resolve(path);
	if (!existsSync(resolved)) {
		throw new Error(`[ui-qa] no config at ${resolved}`);
	}
	const raw = JSON.parse(readFileSync(resolved, "utf8")) as Partial<Config>;
	for (const id of Object.keys(raw.rules ?? {})) {
		if (!RULE_IDS.includes(id)) {
			throw new Error(
				`[ui-qa] ${resolved}: unknown rule "${id}", known rules are ${RULE_IDS.join(", ")}`,
			);
		}
	}
	return { ...DEFAULT_CONFIG, ...raw };
}

async function main(): Promise<number> {
	const { values } = parseArgs({
		options: {
			url: { type: "string", multiple: true, default: [] },
			target: { type: "string", multiple: true, default: [] },
			targets: { type: "string" },
			role: { type: "string" },
			"base-url": { type: "string", default: "http://localhost:3000" },
			viewports: { type: "string" },
			config: { type: "string" },
			baseline: { type: "string" },
			"update-baseline": { type: "boolean", default: false },
			json: { type: "string" },
			"snapshot-out": { type: "string" },
			settle: { type: "string", default: "250" },
			"max-elements": { type: "string", default: "4000" },
			"max-depth": { type: "string", default: "6" },
			examples: { type: "string", default: "4" },
			headed: { type: "boolean", default: false },
			rules: { type: "boolean", default: false },
		},
	});

	if (values.rules) {
		process.stdout.write(`${RULE_IDS.join("\n")}\n`);
		return 0;
	}

	const targets = parseTargets(
		values.target ?? [],
		values.url ?? [],
		values.role,
		values.targets,
	);
	if (targets.length === 0) {
		throw new Error(
			"[ui-qa] nothing to lint: pass --url, --target name=/path or --targets file.json",
		);
	}

	const config = loadConfig(values.config);
	const viewports = parseViewports(values.viewports);
	const { snapshots, spec, failures } = await collect({
		baseURL: values["base-url"] ?? "http://localhost:3000",
		targets,
		viewports,
		settleMs: Number(values.settle),
		maxElements: Number(values["max-elements"]),
		maxDepth: Number(values["max-depth"]),
		headless: !values.headed,
		onProgress: (line) => process.stderr.write(`  … ${line}\n`),
	});

	for (const failure of failures) {
		process.stderr.write(
			`[ui-qa] ${failure.target} @ ${failure.viewport}: ${failure.error}\n`,
		);
	}
	if (snapshots.length === 0) {
		throw new Error("[ui-qa] no target could be measured");
	}
	if (snapshots.some((snapshot) => snapshot.unscoped)) {
		process.stderr.write(
			"[ui-qa] no [data-slot] found on some targets — scanned the whole body, expect vendor markup in the findings\n",
		);
	}

	const violations: Violation[] = [];
	for (const snapshot of snapshots) {
		violations.push(...runRules(snapshot, spec, config));
	}
	violations.push(...runCrossRules(snapshots, spec, config));

	if (values["snapshot-out"]) {
		writeFileSync(
			resolve(values["snapshot-out"]),
			`${JSON.stringify({ spec, snapshots }, null, "\t")}\n`,
		);
	}

	const baselinePath = values.baseline ? resolve(values.baseline) : null;
	if (baselinePath && values["update-baseline"]) {
		const written = writeBaseline(baselinePath, violations);
		process.stdout.write(
			`[ui-qa] baseline written: ${Object.keys(written.entries).length} findings at ${baselinePath}\n`,
		);
		return 0;
	}

	const comparison = compare(
		violations,
		baselinePath ? readBaseline(baselinePath) : null,
	);
	process.stdout.write(
		`${formatReport(comparison, {
			examples: Number(values.examples),
			targets: targets.map((target) => target.name),
			viewports: viewports.map((viewport) => viewport.name),
			elements: snapshots.reduce(
				(total, snapshot) => total + snapshot.elements.length,
				0,
			),
		})}\n`,
	);

	if (values.json) {
		writeFileSync(
			resolve(values.json),
			`${JSON.stringify(
				{
					spec: { baseUnit: spec.baseUnit, spacing: spec.spacing },
					counts: summarize(comparison.fresh),
					fresh: comparison.fresh,
					known: comparison.known.length,
					fixed: comparison.fixed,
					failures,
				},
				null,
				"\t",
			)}\n`,
		);
	}

	const counts = summarize(comparison.fresh);
	return counts.error > 0 || failures.length > 0 ? 1 : 0;
}

if (import.meta.main) {
	main().then(
		(code) => process.exit(code),
		(error) => {
			process.stderr.write(
				`${error instanceof Error ? error.message : String(error)}\n`,
			);
			process.exit(2);
		},
	);
}
