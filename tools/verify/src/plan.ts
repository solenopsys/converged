/**
 * One verification run, as the CLI decided it and the runner carries it out.
 *
 * Written to disk before Playwright starts and read back by the config and the
 * reporter, which live in the runner's processes: environment variables would
 * carry the path, never the plan itself. Node-only, like `stories.ts`.
 */
import { readFileSync } from "node:fs";

export const BROWSERS = ["chromium", "firefox", "webkit"] as const;
export type Browser = (typeof BROWSERS)[number];

export type PlannedStory = {
	id: string;
	title: string;
	required: boolean;
	/** False when the story has no spec: required ones fail the solution. */
	implemented: boolean;
};

export type PlannedSolution = {
	layer: string;
	solution: string;
	value: string;
	stories: PlannedStory[];
};

export type Plan = {
	/** The checkout the run was started from. */
	projectDir: string;
	baseURL: string;
	browsers: Browser[];
	/** `results.json`, `report/` and `artifacts/` land here. */
	outputDir: string;
	retries: number;
	specs: string[];
	solutions: PlannedSolution[];
};

export const PLAN_ENV = "VERIFY_PLAN";

export function readPlan(): Plan {
	const path = process.env[PLAN_ENV];
	if (!path) {
		throw new Error(
			`[verify] ${PLAN_ENV} is not set — start verification through the verify CLI`,
		);
	}
	return JSON.parse(readFileSync(path, "utf8")) as Plan;
}

/** What `results.json` holds: the verdict first, the evidence under it. */
export type StoryResult = {
	id: string;
	title: string;
	required: boolean;
	status: "passed" | "failed" | "missing";
	browsers: Array<{
		browser: string;
		status: string;
		durationMs: number;
		error?: string;
		screenshots: string[];
		trace?: string;
	}>;
};

export type SolutionResult = {
	layer: string;
	solution: string;
	value: string;
	verified: boolean;
	stories: StoryResult[];
};

export type RunResult = {
	startedAt: string;
	baseURL: string;
	browsers: string[];
	verified: boolean;
	solutions: SolutionResult[];
};
