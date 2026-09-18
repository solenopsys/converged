/**
 * verify — acceptance verification of solutions through their Main User Stories.
 *
 *   list                      solutions of this checkout and how covered they are
 *   check [--strict]          stories.json is valid and every required story has a spec
 *   init <solution>           start a solution's stories.json
 *   prompt <solution>         the brief an assistant turns into story specs
 *   run [--solution a,b] [--browser chromium,firefox,webkit|all]
 *       [--base-url URL] [--retries N] [-- playwright args]
 *   install [browsers]        download the browsers Playwright needs
 *
 * Runs from a checkout (`--project-dir`, converged or club) against a stack that
 * is already up: verification is about the application as deployed, so it
 * starts nothing itself.
 */
import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { readObject } from "../../dev/src/solution";
import {
	configPathOf,
	layersOf,
	type SolutionVerification,
	VERIFICATION_DIR,
	verificationsOf,
} from "./layout";
import {
	BROWSERS,
	type Browser,
	PLAN_ENV,
	type Plan,
	type RunResult,
} from "./plan";
import { SPEC_SUFFIX, STORIES_FILE } from "./stories";

const TOOL_DIR = resolve(import.meta.dirname, "..");
const PLAYWRIGHT_CLI = join(TOOL_DIR, "node_modules/@playwright/test/cli.js");

const separator = process.argv.indexOf("--");
const passthrough = separator === -1 ? [] : process.argv.slice(separator + 1);
const { values, positionals } = parseArgs({
	args: process.argv.slice(2, separator === -1 ? undefined : separator),
	allowPositionals: true,
	options: {
		"project-dir": { type: "string", default: process.cwd() },
		solution: { type: "string" },
		browser: { type: "string", default: "chromium" },
		"base-url": { type: "string" },
		retries: { type: "string", default: "0" },
		strict: { type: "boolean", default: false },
	},
});
const projectDir = resolve(values["project-dir"] ?? process.cwd());
const [command, ...args] = positionals;

function at(path: string): string {
	return relative(projectDir, path) || ".";
}

function fail(message: string): never {
	console.error(message);
	process.exit(1);
}

function selected(all: SolutionVerification[]): SolutionVerification[] {
	if (!values.solution) return all;
	const names = values.solution.split(",").map((name) => name.trim());
	const unknown = names.filter(
		(name) => !all.some((entry) => entry.solution === name),
	);
	if (unknown.length > 0) {
		fail(
			`[verify] not deployed by ${at(configPathOf(projectDir))}: ${unknown.join(", ")}`,
		);
	}
	return all.filter((entry) => names.includes(entry.solution));
}

function list(): void {
	for (const entry of verificationsOf(projectDir)) {
		const name = `${entry.layer}/${entry.solution}`.padEnd(28);
		if (!entry.stories || !entry.coverage) {
			console.log(`${name} no stories`);
			continue;
		}
		const { specs, missing, orphans } = entry.coverage;
		const required = entry.stories.stories.filter((story) => story.required);
		console.log(
			`${name} ${entry.stories.stories.length} stories (${required.length} required), ` +
				`${specs.length} with tests` +
				(missing.length
					? `, missing: ${missing.map((s) => s.id).join(", ")}`
					: "") +
				(orphans.length ? `, orphan specs: ${orphans.length}` : ""),
		);
	}
}

function check(): void {
	const problems: string[] = [];
	for (const entry of verificationsOf(projectDir)) {
		const name = `${entry.layer}/${entry.solution}`;
		if (!entry.stories || !entry.coverage) {
			if (values.strict) problems.push(`${name}: no ${STORIES_FILE}`);
			continue;
		}
		for (const story of entry.coverage.missing) {
			if (story.required) {
				problems.push(
					`${name}: required story "${story.id}" has no ${story.id}${SPEC_SUFFIX}`,
				);
			}
		}
		for (const orphan of entry.coverage.orphans) {
			problems.push(
				`${name}: ${at(orphan)} checks no story in ${STORIES_FILE}`,
			);
		}
	}
	if (problems.length > 0) fail(problems.map((line) => `✗ ${line}`).join("\n"));
	console.log("✓ stories and specs agree");
}

/** The layer whose `solutions/` defines the solution — where its stories belong. */
function ownerOf(solution: string) {
	const layer = layersOf(configPathOf(projectDir)).find((candidate) =>
		existsSync(join(candidate.solutionsDir, "solutions", `${solution}.json`)),
	);
	if (!layer)
		fail(`[verify] no layer of ${at(projectDir)} defines "${solution}"`);
	return layer;
}

function init(solution: string | undefined): void {
	if (!solution) fail("Usage: verify init <solution>");
	const layer = ownerOf(solution);
	const dir = join(layer.solutionsDir, VERIFICATION_DIR, solution);
	const path = join(dir, STORIES_FILE);
	if (existsSync(path)) fail(`[verify] ${at(path)} already exists`);
	const definition = readObject(
		join(layer.solutionsDir, "solutions", `${solution}.json`),
	);
	mkdirSync(dir, { recursive: true });
	writeFileSync(
		path,
		`${JSON.stringify(
			{
				solution,
				value: String(definition.summary ?? ""),
				stories: [
					{
						id: "actor-achieves-outcome",
						title: "Actor achieves the outcome the solution exists for",
						actor: "operator",
						required: true,
						criteria: ["Replace with an observable result the actor gets"],
					},
				],
			},
			null,
			"\t",
		)}\n`,
	);
	console.log(
		`created ${at(path)} — write the Main User Stories, then: verify prompt ${solution}`,
	);
}

/** `sf-<name>` directories, flat (club) or grouped by category (converged). */
function surfaceDirs(root: string, surface: string): string[] {
	const base = join(root, "modules/surfaces");
	if (!existsSync(base)) return [];
	const name = `sf-${surface}`;
	const found: string[] = [];
	if (existsSync(join(base, name))) found.push(join(base, name));
	for (const group of readdirSync(base, { withFileTypes: true })) {
		if (group.isDirectory() && existsSync(join(base, group.name, name))) {
			found.push(join(base, group.name, name));
		}
	}
	return found;
}

function prompt(solution: string | undefined): void {
	if (!solution) fail("Usage: verify prompt <solution>");
	const layer = ownerOf(solution);
	const entry = verificationsOf(projectDir).find(
		(item) => item.solution === solution,
	);
	if (!entry?.stories || !entry.coverage) {
		fail(
			`[verify] ${solution} has no ${STORIES_FILE} yet — start with: verify init ${solution}`,
		);
	}
	const definition = readObject(
		join(layer.solutionsDir, "solutions", `${solution}.json`),
	);
	const layers = layersOf(configPathOf(projectDir));
	const surfaces = (definition.surfaces as string[] | undefined) ?? [];
	const docs = surfaces.flatMap((surface) =>
		layers.flatMap((candidate) => surfaceDirs(candidate.root, surface)),
	);
	const examples = verificationsOf(projectDir)
		.flatMap((item) => item.coverage?.specs ?? [])
		.slice(0, 3);
	const todo = entry.coverage.missing;

	const out = [
		`# Verification specs for solution "${solution}"`,
		"",
		"Turn each story below into one Playwright spec. Rules:",
		"",
		`- One file per story: \`${at(entry.dir)}/<story-id>${SPEC_SUFFIX}\`, containing exactly one \`story(import.meta.url, ...)\` call.`,
		'- Import only from "solution-verify" (`story`, `expect`, `test` for `test.step`). Fixtures: `page`, `signIn(role)`, `workspace.open(surface, ...path)`, `workspace.section/view(name)`, `unique(prefix)`, `asset(name)`.',
		`- A missing action goes into ${at(join(TOOL_DIR, "src/primitives.ts"))} as a reusable primitive, not inline in the spec.`,
		"- Walk the real UI as the story's actor: accessible roles and names (getByRole, getByLabel, getByText), no CSS selectors, no direct API or store calls.",
		"- Assert the criteria — the outcome the actor gets — not that intermediate modules exist. Authentication, files, storage and workflows are passed through, not tested separately.",
		"- Create the data the story needs through the UI with `unique()` names; never depend on data another story made.",
		`- Upload fixtures go to \`${at(entry.dir)}/assets/\`.`,
		"- Done means `verify run --solution " +
			solution +
			"` passes against the running stack; the run result is the source of truth, not the generated code.",
		"",
		`## Solution: ${String(definition.title ?? solution)}`,
		"",
		String(definition.summary ?? ""),
		"",
		`Value: ${entry.stories.value}`,
		"",
		"## Stories",
		"",
		...entry.stories.stories.flatMap((story) => [
			`### ${story.id}${todo.includes(story) ? " — needs a spec" : " — has a spec"}`,
			"",
			`${story.title} (actor: ${story.actor}${story.required ? "" : ", optional"})`,
			"",
			...story.criteria.map((criterion) => `- ${criterion}`),
			"",
		]),
		"## Where to look",
		"",
		...docs.map((dir) => `- ${at(dir)} (surface: docs/, src/views)`),
		`- ${at(join(TOOL_DIR, "src/primitives.ts"))}`,
		...examples.map((example) => `- example spec: ${at(example.file)}`),
		"",
	];
	console.log(out.join("\n"));
}

function browsersOf(value: string): Browser[] {
	if (value === "all") return [...BROWSERS];
	const names = value.split(",").map((name) => name.trim()) as Browser[];
	const unknown = names.filter((name) => !BROWSERS.includes(name));
	if (unknown.length > 0) {
		fail(
			`[verify] unknown browser: ${unknown.join(", ")} (${BROWSERS.join(", ")}, all)`,
		);
	}
	return names;
}

function baseUrlOf(): string {
	const explicit = values["base-url"] ?? process.env.VERIFY_BASE_URL;
	if (explicit) return explicit.replace(/\/+$/, "");
	// Same rule as the dev runner: the UI listens on LANDING_PORT, else PORT + 1.
	const port = Number(process.env.PORT ?? "3001");
	return `http://127.0.0.1:${process.env.LANDING_PORT ?? port + 1}`;
}

async function run(): Promise<void> {
	const entries = selected(verificationsOf(projectDir));
	const planned = values.solution
		? entries
		: entries.filter((entry) => entry.stories !== undefined);
	for (const entry of planned) {
		for (const orphan of entry.coverage?.orphans ?? []) {
			fail(`[verify] ${at(orphan)} checks no story in ${STORIES_FILE}`);
		}
	}

	const baseURL = baseUrlOf();
	try {
		await fetch(baseURL, {
			method: "HEAD",
			signal: AbortSignal.timeout(5_000),
		});
	} catch {
		fail(
			`[verify] ${baseURL} does not answer — start the stack first (bun run dev:all)`,
		);
	}

	const outputDir = join(projectDir, "dist", VERIFICATION_DIR);
	rmSync(outputDir, { recursive: true, force: true });
	mkdirSync(outputDir, { recursive: true });
	const plan: Plan = {
		projectDir,
		baseURL,
		browsers: browsersOf(values.browser ?? "chromium"),
		outputDir,
		retries: Number(values.retries),
		specs: planned.flatMap(
			(entry) => entry.coverage?.specs.map((spec) => spec.file) ?? [],
		),
		solutions: planned.map((entry) => ({
			layer: entry.layer,
			solution: entry.solution,
			value: entry.stories?.value ?? "",
			stories: (entry.stories?.stories ?? []).map((story) => ({
				id: story.id,
				title: story.title,
				required: story.required,
				implemented: !entry.coverage?.missing.includes(story),
			})),
		})),
	};
	const planPath = join(outputDir, "plan.json");
	writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);

	const result = spawnSync(
		"node",
		[
			PLAYWRIGHT_CLI,
			"test",
			"--config",
			join(TOOL_DIR, "playwright.config.ts"),
			"--pass-with-no-tests",
			...passthrough,
		],
		{ stdio: "inherit", env: { ...process.env, [PLAN_ENV]: planPath } },
	);

	const resultsPath = join(outputDir, "results.json");
	if (!existsSync(resultsPath)) process.exit(result.status ?? 1);
	const results = JSON.parse(readFileSync(resultsPath, "utf8")) as RunResult;
	process.exit(results.verified ? 0 : 1);
}

function install(): void {
	const browsers = args.length > 0 ? args : ["chromium"];
	const result = spawnSync("node", [PLAYWRIGHT_CLI, "install", ...browsers], {
		stdio: "inherit",
	});
	process.exit(result.status ?? 1);
}

switch (command) {
	case "list":
		list();
		break;
	case "check":
		check();
		break;
	case "init":
		init(args[0]);
		break;
	case "prompt":
		prompt(args[0]);
		break;
	case "run":
		await run();
		break;
	case "install":
		install();
		break;
	default:
		console.log(readFileSync(import.meta.filename, "utf8").split("*/")[0]);
		process.exit(command ? 1 : 0);
}
