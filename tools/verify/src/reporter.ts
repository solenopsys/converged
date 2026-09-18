/**
 * Turns Playwright's test results back into solution verdicts.
 *
 * Playwright knows tests and browsers; the question asked here is "is this
 * solution verified". A story passes when it passed in every browser of the
 * run, a solution is verified when every required story passes, and a required
 * story nobody implemented counts as failed — an unwritten test proves nothing.
 *
 * Writes `results.json` beside the HTML report and prints the verdict block.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import type {
	FullResult,
	Reporter,
	TestCase,
	TestResult,
} from "@playwright/test/reporter";
import {
	type Plan,
	type RunResult,
	readPlan,
	type SolutionResult,
	type StoryResult,
} from "./plan";

type Attempt = StoryResult["browsers"][number];

function annotation(test: TestCase, type: string): string | undefined {
	return test.annotations.find((entry) => entry.type === type)?.description;
}

function plain(text: string | undefined): string | undefined {
	// Playwright colours its messages for the terminal; the file keeps plain text.
	// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping ANSI
	return text?.replace(/\u001b\[[0-9;]*m/g, "").trim();
}

export default class VerificationReporter implements Reporter {
	private readonly plan: Plan = readPlan();
	private readonly startedAt = new Date().toISOString();
	/** `solution/story` → one final attempt per browser. */
	private readonly attempts = new Map<string, Map<string, Attempt>>();

	printsToStdio(): boolean {
		return false;
	}

	onTestEnd(test: TestCase, result: TestResult): void {
		const solution = annotation(test, "solution");
		const story = annotation(test, "story");
		if (!solution || !story) return;
		const browser = test.parent.project()?.name ?? "default";
		const key = `${solution}/${story}`;
		const byBrowser = this.attempts.get(key) ?? new Map<string, Attempt>();
		// Retries report every attempt; the last one is the answer.
		byBrowser.set(browser, {
			browser,
			status: result.status,
			durationMs: result.duration,
			...(result.error || result.errors.length > 0
				? {
						error: plain(result.error?.message ?? result.errors[0]?.message),
					}
				: {}),
			screenshots: result.attachments
				.filter((item) => item.name === "screenshot" && item.path)
				.map((item) => item.path as string),
			trace: result.attachments.find((item) => item.name === "trace")?.path,
		});
		this.attempts.set(key, byBrowser);
	}

	onEnd(_result: FullResult): void {
		const solutions = this.plan.solutions.map((planned): SolutionResult => {
			const stories = planned.stories.map((story): StoryResult => {
				const browsers = [
					...(this.attempts.get(`${planned.solution}/${story.id}`)?.values() ??
						[]),
				];
				// A spec that exists but never reported (a collection error, an
				// interrupted run) is a failure, not a story nobody wrote.
				const status = !story.implemented
					? "missing"
					: browsers.length === this.plan.browsers.length &&
							browsers.every((attempt) => attempt.status === "passed")
						? "passed"
						: "failed";
				return {
					id: story.id,
					title: story.title,
					required: story.required,
					status,
					browsers,
				};
			});
			return {
				layer: planned.layer,
				solution: planned.solution,
				value: planned.value,
				// No stories is no evidence: such a solution is not verified.
				verified:
					stories.length > 0 &&
					stories.every(
						(story) => !story.required || story.status === "passed",
					),
				stories,
			};
		});

		const run: RunResult = {
			startedAt: this.startedAt,
			baseURL: this.plan.baseURL,
			browsers: this.plan.browsers,
			verified: solutions.every((solution) => solution.verified),
			solutions,
		};
		mkdirSync(this.plan.outputDir, { recursive: true });
		writeFileSync(
			join(this.plan.outputDir, "results.json"),
			`${JSON.stringify(run, null, 2)}\n`,
		);
		console.log(this.render(run));
	}

	private render(run: RunResult): string {
		const lines: string[] = [""];
		const at = (path: string) => relative(this.plan.projectDir, path);
		for (const solution of run.solutions) {
			lines.push(
				`${solution.layer}/${solution.solution}`,
				"  Verification",
				"",
			);
			if (solution.stories.length === 0) lines.push("  no stories");
			for (const story of solution.stories) {
				const mark = story.status === "passed" ? "✓" : "✗";
				const optional = story.required ? "" : " (optional)";
				const missing =
					story.status === "missing"
						? " — no test"
						: story.browsers.length === 0
							? " — did not run"
							: "";
				lines.push(`  ${mark} ${story.title}${optional}${missing}`);
				for (const attempt of story.browsers) {
					if (attempt.status === "passed") continue;
					const reason = attempt.error?.split("\n")[0] ?? attempt.status;
					lines.push(`      [${attempt.browser}] ${reason}`);
					if (attempt.trace) lines.push(`      trace: ${at(attempt.trace)}`);
				}
			}
			lines.push("", `  ${solution.verified ? "PASS" : "FAIL"}`, "");
		}
		lines.push(
			`results: ${at(join(this.plan.outputDir, "results.json"))}`,
			`report:  ${at(join(this.plan.outputDir, "report"))}`,
		);
		return lines.join("\n");
	}
}
